import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as eventbridge from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { EventbridgeToLambda } from '@aws-solutions-constructs/aws-eventbridge-lambda';
import { Construct } from 'constructs';

export class CalisthenicsAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, 'CalisthenicsUserPool', {
      userPoolName: 'calisthenics-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: true }), // Legacy - kept for compatibility
        division: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: true }), // Legacy - kept for compatibility
        isSuperAdmin: new cognito.StringAttribute({ minLen: 1, maxLen: 5, mutable: true }), // 'true' or 'false'
        organizerRole: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: true }), // 'super_admin', 'event_admin', 'auxiliary_admin'
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'CalisthenicsUserPoolClient', {
      userPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // DynamoDB Tables - Multi-tenant architecture with event isolation
    // Using On-Demand billing for cost optimization and unpredictable traffic patterns
    
    // Events table - Main events (e.g., "Summer Games 2025")
    const eventsTable = new dynamodb.Table(this, 'EventsTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    eventsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startDate', type: dynamodb.AttributeType.STRING },
    });

    // Organizations table
    const organizationsTable = new dynamodb.Table(this, 'OrganizationsTable', {
      partitionKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Organization Members (many-to-many: users to organizations)
    const organizationMembersTable = new dynamodb.Table(this, 'OrganizationMembersTable', {
      partitionKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    organizationMembersTable.addGlobalSecondaryIndex({
      indexName: 'user-organizations-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
    });

    // Organization-Event mapping (events belong to organizations)
    const organizationEventsTable = new dynamodb.Table(this, 'OrganizationEventsTable', {
      partitionKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    organizationEventsTable.addGlobalSecondaryIndex({
      indexName: 'event-organization-index',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
    });

    // Legacy: Keep for backward compatibility during migration
    const organizerEventsTable = new dynamodb.Table(this, 'OrganizerEventsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    organizerEventsTable.addGlobalSecondaryIndex({
      indexName: 'event-organizers-index',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    // Athlete-Event registrations (many-to-many)
    const athleteEventsTable = new dynamodb.Table(this, 'AthleteEventsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    athleteEventsTable.addGlobalSecondaryIndex({
      indexName: 'event-athletes-index',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'registeredAt', type: dynamodb.AttributeType.STRING },
    });

    // Athletes table - Global user profiles
    const athletesTable = new dynamodb.Table(this, 'AthletesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Event Days table - Individual days/sessions within an event
    const eventDaysTable = new dynamodb.Table(this, 'EventDaysTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dayId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Categories table - Event-scoped
    const categoriesTable = new dynamodb.Table(this, 'CategoriesTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'categoryId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // WODs table - Event-scoped
    const wodsTable = new dynamodb.Table(this, 'WodsTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'wodId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Scores table - Event-scoped with composite key for efficient queries
    const scoresTable = new dynamodb.Table(this, 'ScoresTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scoreId', type: dynamodb.AttributeType.STRING }, // Format: dayId#athleteId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    scoresTable.addGlobalSecondaryIndex({
      indexName: 'day-scores-index',
      partitionKey: { name: 'dayId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'score', type: dynamodb.AttributeType.NUMBER },
    });

    // Scoring Systems table - Event-scoped scoring configurations
    const scoringSystemsTable = new dynamodb.Table(this, 'ScoringSystemsTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scoringSystemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Exercise Library table - Global exercise definitions
    const exerciseLibraryTable = new dynamodb.Table(this, 'ExerciseLibraryTable', {
      partitionKey: { name: 'exerciseId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Leaderboard Cache table - Pre-calculated leaderboards
    const leaderboardCacheTable = new dynamodb.Table(this, 'LeaderboardCacheTable', {
      partitionKey: { name: 'leaderboardId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });
    leaderboardCacheTable.addGlobalSecondaryIndex({
      indexName: 'event-leaderboards-index',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
    });

    // Sessions table - User session management with TTL
    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Schedules table - Competition schedules
    const schedulesTable = new dynamodb.Table(this, 'SchedulesTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scheduleId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Heats table - Individual competition heats
    const heatsTable = new dynamodb.Table(this, 'HeatsTable', {
      partitionKey: { name: 'scheduleId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'heatId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Classification Filters table - Elimination rules
    const classificationFiltersTable = new dynamodb.Table(this, 'ClassificationFiltersTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'filterId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 Bucket for frontend hosting
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `calisthenics-app-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // S3 Bucket for event images
    const eventImagesBucket = new s3.Bucket(this, 'EventImagesBucket', {
      bucketName: `calisthenics-event-images-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    });

    // CloudFront Origin Access Control (OAC) - latest CDK syntax
    const originAccessControl = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
      originAccessControlConfig: {
        name: 'calisthenics-app-oac',
        description: 'OAC for Calisthenics App',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Grant CloudFront access to S3 bucket via bucket policy
    websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [websiteBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    }));

    // Microservices: Separate Lambda per domain
    const commonEnv = {
      USER_POOL_ID: userPool.userPoolId,
    };

    // Organizations service
    const organizationsLambda = new lambda.Function(this, 'OrganizationsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'organizations.handler',
      code: lambda.Code.fromAsset('lambda/organizations'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        ORGANIZATIONS_TABLE: organizationsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
        ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
      },
    });
    organizationsTable.grantReadWriteData(organizationsLambda);
    organizationMembersTable.grantReadWriteData(organizationsLambda);
    organizationEventsTable.grantReadWriteData(organizationsLambda);
    
    // Grant Cognito permissions to fetch user details
    organizationsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminGetUser'],
      resources: [userPool.userPoolArn]
    }));

    // Competitions service - Handles competitions and public events endpoints
    const competitionsLambda = new lambda.Function(this, 'CompetitionsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Competitions service with public events endpoints - v2',
      environment: {
        ...commonEnv,
        EVENTS_TABLE: eventsTable.tableName,
        ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
        EVENT_IMAGES_BUCKET: eventImagesBucket.bucketName,
      },
    });
    eventsTable.grantReadWriteData(competitionsLambda);
    organizationEventsTable.grantReadWriteData(competitionsLambda);
    organizationMembersTable.grantReadData(competitionsLambda); // Read-only for authorization
    eventImagesBucket.grantPut(competitionsLambda);
    
    // Grant EventBridge permissions for event-driven communication
    competitionsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: ['*'],
    }));

    // Event Days service
    const eventsLambda = new lambda.Function(this, 'EventsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'events.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        EVENT_DAYS_TABLE: eventDaysTable.tableName,
        EVENT_IMAGES_BUCKET: eventImagesBucket.bucketName,
        SCORING_SYSTEMS_LAMBDA_NAME: '', // Will be set after scoringSystemsLambda is created
      },
    });
    eventDaysTable.grantReadWriteData(eventsLambda);
    eventImagesBucket.grantReadWrite(eventsLambda);

    // Scores service
    const scoresLambda = new lambda.Function(this, 'ScoresLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Scores service - v5 with RBAC authorization',
      environment: {
        ...commonEnv,
        SCORES_TABLE: scoresTable.tableName,
        ATHLETES_TABLE: athletesTable.tableName,
        SCORING_SYSTEMS_TABLE: scoringSystemsTable.tableName,
        ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
      },
    });
    scoresTable.grantReadWriteData(scoresLambda);
    athletesTable.grantReadData(scoresLambda);
    scoringSystemsTable.grantReadData(scoresLambda);
    organizationEventsTable.grantReadData(scoresLambda);
    organizationMembersTable.grantReadData(scoresLambda);
    scoresLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: ['*'],
    }));

    // Scoring Systems service
    const scoringSystemsLambda = new lambda.Function(this, 'ScoringSystemsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'systems.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        SCORING_SYSTEMS_TABLE: scoringSystemsTable.tableName,
      },
    });
    scoringSystemsTable.grantReadWriteData(scoringSystemsLambda);
    
    // Update eventsLambda environment with scoringSystemsLambda name
    eventsLambda.addEnvironment('SCORING_SYSTEMS_LAMBDA_NAME', scoringSystemsLambda.functionName);
    scoringSystemsLambda.grantInvoke(eventsLambda);

    // Exercise Library service
    const exerciseLibraryLambda = new lambda.Function(this, 'ExerciseLibraryLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'exercise-library.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        EXERCISE_LIBRARY_TABLE: exerciseLibraryTable.tableName,
      },
    });
    exerciseLibraryTable.grantReadWriteData(exerciseLibraryLambda);

    // Score Calculator service (stateless calculation engine)
    const scoreCalculatorLambda = new lambda.Function(this, 'ScoreCalculatorLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'score-calculator.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
      },
    });

    // Leaderboard API service
    const leaderboardApiLambda = new lambda.Function(this, 'LeaderboardApiLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'leaderboard-api.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        LEADERBOARD_TABLE: leaderboardCacheTable.tableName,
        SCORES_TABLE: scoresTable.tableName,
      },
    });
    leaderboardCacheTable.grantReadData(leaderboardApiLambda);
    scoresTable.grantReadData(leaderboardApiLambda);

    // Categories service
    const categoriesLambda = new lambda.Function(this, 'CategoriesLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/categories'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Categories service - v5 with RBAC authorization',
      environment: {
        ...commonEnv,
        CATEGORIES_TABLE: categoriesTable.tableName,
        ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
      },
    });
    categoriesTable.grantReadWriteData(categoriesLambda);
    organizationEventsTable.grantReadData(categoriesLambda);
    organizationMembersTable.grantReadData(categoriesLambda);

    // WODs service
    const wodsLambda = new lambda.Function(this, 'WodsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/wods'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'WODs service - DDD compliant - v5 with RBAC authorization',
      environment: {
        ...commonEnv,
        WODS_TABLE: wodsTable.tableName,
        ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
        SCORES_TABLE: scoresTable.tableName,
      },
    });
    wodsTable.grantReadWriteData(wodsLambda);
    organizationEventsTable.grantReadData(wodsLambda);
    organizationMembersTable.grantReadData(wodsLambda);
    scoresTable.grantReadData(wodsLambda);

    // Users service
    const usersLambda = new lambda.Function(this, 'UsersLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/athletes'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      reservedConcurrentExecutions: 10,  // Prevent runaway costs
      description: 'Athletes service - v3 with RBAC authorization',
      environment: {
        ...commonEnv,
        ATHLETES_TABLE: athletesTable.tableName,
        ATHLETE_EVENTS_TABLE: athleteEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
      },
    });
    athletesTable.grantReadWriteData(usersLambda);
    athleteEventsTable.grantReadWriteData(usersLambda);
    organizationMembersTable.grantReadData(usersLambda);

    // Analytics service
    const analyticsLambda = new lambda.Function(this, 'AnalyticsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'analytics.handler',
      code: lambda.Code.fromAsset('lambda/shared'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      reservedConcurrentExecutions: 5,
      description: 'Analytics service with organization filtering - v1',
      environment: {
        ...commonEnv,
        EVENTS_TABLE: eventsTable.tableName,
        ATHLETES_TABLE: athletesTable.tableName,
        ATHLETE_EVENTS_TABLE: athleteEventsTable.tableName,
        CATEGORIES_TABLE: categoriesTable.tableName,
        WODS_TABLE: wodsTable.tableName,
        SCORES_TABLE: scoresTable.tableName,
        ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
      },
    });
    eventsTable.grantReadData(analyticsLambda);
    athletesTable.grantReadData(analyticsLambda);
    athleteEventsTable.grantReadData(analyticsLambda);
    categoriesTable.grantReadData(analyticsLambda);
    wodsTable.grantReadData(analyticsLambda);
    scoresTable.grantReadData(analyticsLambda);
    organizationEventsTable.grantReadData(analyticsLambda);
    organizationMembersTable.grantReadData(analyticsLambda);

    // Sessions service
    const sessionsLambda = new lambda.Function(this, 'SessionsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'sessions.handler',
      code: lambda.Code.fromAsset('lambda/scheduling'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      reservedConcurrentExecutions: 10,
      environment: {
        ...commonEnv,
        SESSIONS_TABLE: sessionsTable.tableName,
      },
    });
    sessionsTable.grantReadWriteData(sessionsLambda);

    // Step Functions Task Lambda Functions
    const getEventDataLambda = new lambda.Function(this, 'GetEventDataLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'get-event-data.handler',
      code: lambda.Code.fromAsset('lambda/shared'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        EVENTS_TABLE: eventsTable.tableName,
        EVENT_DAYS_TABLE: eventDaysTable.tableName,
      },
    });

    const getAthletesDataLambda = new lambda.Function(this, 'GetAthletesDataLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'get-athletes-data.handler',
      code: lambda.Code.fromAsset('lambda/athletes'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        ATHLETES_TABLE: athletesTable.tableName,
        ATHLETE_EVENTS_TABLE: athleteEventsTable.tableName,
      },
    });

    const getCategoriesDataLambda = new lambda.Function(this, 'GetCategoriesDataLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'get-categories-data.handler',
      code: lambda.Code.fromAsset('lambda/categories'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        CATEGORIES_TABLE: categoriesTable.tableName,
      },
    });

    const getWodsDataLambda = new lambda.Function(this, 'GetWodsDataLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'get-wods-data.handler',
      code: lambda.Code.fromAsset('lambda/wods'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonEnv,
        WODS_TABLE: wodsTable.tableName,
      },
    });

    const generateScheduleLambda = new lambda.Function(this, 'GenerateScheduleLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'generate-schedule.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 512,
      timeout: cdk.Duration.minutes(1),
      environment: {
        ...commonEnv,
        SCHEDULES_TABLE: schedulesTable.tableName,
      },
    });

    // Grant permissions
    eventsTable.grantReadData(getEventDataLambda);
    eventDaysTable.grantReadData(getEventDataLambda);
    athletesTable.grantReadData(getAthletesDataLambda);
    athleteEventsTable.grantReadData(getAthletesDataLambda);
    categoriesTable.grantReadData(getCategoriesDataLambda);
    wodsTable.grantReadData(getWodsDataLambda);
    schedulesTable.grantReadWriteData(generateScheduleLambda);

    // Step Functions Express Workflow
    const getEventDataTask = new stepfunctionsTasks.LambdaInvoke(this, 'GetEventDataTask', {
      lambdaFunction: getEventDataLambda,
      resultPath: '$.eventResult'
    });

    const getAthletesDataTask = new stepfunctionsTasks.LambdaInvoke(this, 'GetAthletesDataTask', {
      lambdaFunction: getAthletesDataLambda,
      resultPath: '$.athletesResult'
    });

    const getCategoriesDataTask = new stepfunctionsTasks.LambdaInvoke(this, 'GetCategoriesDataTask', {
      lambdaFunction: getCategoriesDataLambda,
      resultPath: '$.categoriesResult'
    });

    const getWodsDataTask = new stepfunctionsTasks.LambdaInvoke(this, 'GetWodsDataTask', {
      lambdaFunction: getWodsDataLambda,
      resultPath: '$.wodsResult'
    });

    const generateScheduleTask = new stepfunctionsTasks.LambdaInvoke(this, 'GenerateScheduleTask', {
      lambdaFunction: generateScheduleLambda,
      payload: stepfunctions.TaskInput.fromObject({
        'eventId.$': '$[0].eventId',
        'config.$': '$[0].config',
        'eventData.$': '$[0].eventResult.Payload.eventData',
        'days.$': '$[0].eventResult.Payload.days',
        'athletes.$': '$[1].athletesResult.Payload.athletes',
        'categories.$': '$[2].categoriesResult.Payload.categories',
        'wods.$': '$[3].wodsResult.Payload.wods'
      }),
      outputPath: '$.Payload'
    });

    // Parallel data collection
    const parallelDataCollection = new stepfunctions.Parallel(this, 'ParallelDataCollection')
      .branch(getEventDataTask)
      .branch(getAthletesDataTask)
      .branch(getCategoriesDataTask)
      .branch(getWodsDataTask);

    const schedulerWorkflow = parallelDataCollection.next(generateScheduleTask);

    // Express State Machine
    const schedulerStateMachine = new stepfunctions.StateMachine(this, 'SchedulerStateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(schedulerWorkflow),
      stateMachineType: stepfunctions.StateMachineType.EXPRESS,
      timeout: cdk.Duration.minutes(2)
    });

    // DDD-Compliant Scheduler Lambda
    const schedulerLambda = new lambda.Function(this, 'SchedulerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'scheduler-stepfunctions.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      description: 'DDD-compliant Competition Scheduler Service - v8.0',
      environment: {
        ...commonEnv,
        SCHEDULES_TABLE: schedulesTable.tableName,
        SCHEDULER_STATE_MACHINE_ARN: schedulerStateMachine.stateMachineArn,
      },
    });
    
    // Grant permissions to owned table (Schedule bounded context)
    schedulesTable.grantReadWriteData(schedulerLambda);
    
    // Grant Step Functions execution permission
    schedulerStateMachine.grantStartSyncExecution(schedulerLambda);
    
    // Grant EventBridge permissions for domain events
    schedulerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/default`]
    }));

    // DDD Scheduler Lambda (separate from Step Functions scheduler)
    const dddSchedulerLambda = new lambda.Function(this, 'DDDSchedulerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'ddd-handler.handler',
      code: lambda.Code.fromAsset('lambda/scheduling'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'DDD Scheduler - v2 with RBAC authorization',
      environment: {
        ...commonEnv,
        SCHEDULES_TABLE: schedulesTable.tableName,
        HEATS_TABLE: heatsTable.tableName,
        CLASSIFICATION_FILTERS_TABLE: classificationFiltersTable.tableName,
        ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
      },
    });
    
    // Grant permissions for DDD scheduler
    schedulesTable.grantReadWriteData(dddSchedulerLambda);
    heatsTable.grantReadWriteData(dddSchedulerLambda);
    classificationFiltersTable.grantReadWriteData(dddSchedulerLambda);
    organizationEventsTable.grantReadData(dddSchedulerLambda);
    organizationMembersTable.grantReadData(dddSchedulerLambda);

    // Public Schedules Lambda for athlete access (uses DDD scheduler for published schedules)
    const publicSchedulesLambda = new lambda.Function(this, 'PublicSchedulesLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'public-schedules-ddd.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Public schedules service for athlete access - DDD v2.0',
      environment: {
        ...commonEnv,
        SCHEDULES_TABLE: schedulesTable.tableName,
      },
    });
    
    schedulesTable.grantReadData(publicSchedulesLambda);

    // EventBridge handlers for all domains
    const eventsEventBridgeHandler = new lambda.Function(this, 'EventsEventBridgeHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'events-eventbridge-handler.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Events domain EventBridge handler - v2',
      environment: {
        ...commonEnv,
        EVENTS_TABLE: eventsTable.tableName,
        EVENT_DAYS_TABLE: eventDaysTable.tableName,
        EVENT_BUS_NAME: 'default',
      },
    });
    
    eventsTable.grantReadData(eventsEventBridgeHandler);
    eventDaysTable.grantReadData(eventsEventBridgeHandler);
    eventsEventBridgeHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: ['*']
    }));

    const athletesEventBridgeHandler = new lambda.Function(this, 'AthletesEventBridgeHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'athletes-eventbridge-handler.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Athletes domain EventBridge handler - v1',
      environment: {
        ...commonEnv,
        ATHLETES_TABLE: athletesTable.tableName,
        ATHLETE_EVENTS_TABLE: athleteEventsTable.tableName,
        EVENT_BUS_NAME: 'default',
      },
    });
    
    athletesTable.grantReadData(athletesEventBridgeHandler);
    athleteEventsTable.grantReadData(athletesEventBridgeHandler);
    athletesEventBridgeHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: ['*']
    }));

    const categoriesEventBridgeHandler = new lambda.Function(this, 'CategoriesEventBridgeHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'categories-eventbridge-handler.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Categories domain EventBridge handler - v1',
      environment: {
        ...commonEnv,
        CATEGORIES_TABLE: categoriesTable.tableName,
        EVENT_BUS_NAME: 'default',
      },
    });
    
    categoriesTable.grantReadData(categoriesEventBridgeHandler);
    categoriesEventBridgeHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: ['*']
    }));

    const wodsEventBridgeHandler = new lambda.Function(this, 'WodsEventBridgeHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'wods-eventbridge-handler.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'WODs domain EventBridge handler - v1',
      environment: {
        ...commonEnv,
        WODS_TABLE: wodsTable.tableName,
        EVENT_BUS_NAME: 'default',
      },
    });
    
    wodsTable.grantReadData(wodsEventBridgeHandler);
    wodsEventBridgeHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: ['*']
    }));

    // EventBridge rules for domain event handlers
    const eventBus = eventbridge.EventBus.fromEventBusName(this, 'DefaultEventBus', 'default');
    
    // Rules for data requests from scheduler orchestrator
    new eventbridge.Rule(this, 'EventDataRequestRule', {
      eventBus,
      eventPattern: {
        source: ['scheduler.orchestrator'],
        detailType: ['Event Data Requested']
      },
      targets: [new targets.LambdaFunction(eventsEventBridgeHandler)]
    });

    new eventbridge.Rule(this, 'AthletesDataRequestRule', {
      eventBus,
      eventPattern: {
        source: ['scheduler.orchestrator'],
        detailType: ['Athletes Data Requested']
      },
      targets: [new targets.LambdaFunction(athletesEventBridgeHandler)]
    });

    new eventbridge.Rule(this, 'CategoriesDataRequestRule', {
      eventBus,
      eventPattern: {
        source: ['scheduler.orchestrator'],
        detailType: ['Categories Data Requested']
      },
      targets: [new targets.LambdaFunction(categoriesEventBridgeHandler)]
    });

    new eventbridge.Rule(this, 'WodsDataRequestRule', {
      eventBus,
      eventPattern: {
        source: ['scheduler.orchestrator'],
        detailType: ['WODs Data Requested']
      },
      targets: [new targets.LambdaFunction(wodsEventBridgeHandler)]
    });

    // Rules for domain responses back to scheduler orchestrator
    new eventbridge.Rule(this, 'DomainResponsesRule', {
      eventBus,
      eventPattern: {
        source: ['events.domain', 'athletes.domain', 'categories.domain', 'wods.domain'],
        detailType: ['Event Data Response', 'Athletes Data Response', 'Categories Data Response', 'WODs Data Response']
      },
      targets: [new targets.LambdaFunction(schedulerLambda)]
    });

    // EventBridge for decoupled leaderboard calculations
    const leaderboardCalculator = new EventbridgeToLambda(this, 'LeaderboardCalculator', {
      lambdaFunctionProps: {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'leaderboard-calculator-enhanced.handler',
        code: lambda.Code.fromAsset('lambda/competitions'),
        memorySize: 512,
        timeout: cdk.Duration.minutes(5),
        environment: {
          SCORES_TABLE: scoresTable.tableName,
          LEADERBOARD_TABLE: leaderboardCacheTable.tableName,
        },
      },
      eventRuleProps: {
        eventPattern: {
          source: ['scoringames.scores'],
          detailType: ['ScoreCalculated'],
        },
      },
    });
    scoresTable.grantReadData(leaderboardCalculator.lambdaFunction);
    leaderboardCacheTable.grantReadWriteData(leaderboardCalculator.lambdaFunction);

    // API Gateway with microservices routing
    const api = new apigateway.RestApi(this, 'CalisthenicsApi', {
      restApiName: 'Calisthenics Competition API',
      deployOptions: {
        throttlingBurstLimit: 100,  // Max concurrent requests
        throttlingRateLimit: 50,    // Requests per second
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // Public endpoint for published events - /public/events (no auth required)
    const publicResource = api.root.addResource('public');
    const publicEvents = publicResource.addResource('events');
    publicEvents.addMethod('GET', new apigateway.LambdaIntegration(competitionsLambda));
    const publicEventsProxy = publicEvents.addResource('{proxy+}');
    publicEventsProxy.addMethod('GET', new apigateway.LambdaIntegration(competitionsLambda));

    // Public endpoint for published schedules - /public/schedules (no auth required)
    const publicSchedules = publicResource.addResource('schedules');
    publicSchedules.addMethod('GET', new apigateway.LambdaIntegration(publicSchedulesLambda));
    const publicSchedulesProxy = publicSchedules.addResource('{proxy+}');
    publicSchedulesProxy.addMethod('GET', new apigateway.LambdaIntegration(publicSchedulesLambda));

    // Public endpoint for scores - /public/scores (no auth required)
    const publicScores = publicResource.addResource('scores');
    publicScores.addMethod('GET', new apigateway.LambdaIntegration(scoresLambda));

    // Competitions microservice - /competitions/* (auth required)
    const competitions = api.root.addResource('competitions');
    competitions.addMethod('ANY', new apigateway.LambdaIntegration(competitionsLambda), { authorizer: cognitoAuthorizer });
    const competitionsProxy = competitions.addResource('{proxy+}');
    competitionsProxy.addMethod('ANY', new apigateway.LambdaIntegration(competitionsLambda), { authorizer: cognitoAuthorizer });

    // Organizations microservice - /organizations/*
    const organizations = api.root.addResource('organizations');
    organizations.addMethod('ANY', new apigateway.LambdaIntegration(organizationsLambda), { authorizer: cognitoAuthorizer });
    const organizationsProxy = organizations.addResource('{proxy+}');
    organizationsProxy.addMethod('ANY', new apigateway.LambdaIntegration(organizationsLambda), { authorizer: cognitoAuthorizer });

    // Events microservice - /events/*
    const events = api.root.addResource('events');
    events.addMethod('ANY', new apigateway.LambdaIntegration(eventsLambda), { authorizer: cognitoAuthorizer });
    const eventsProxy = events.addResource('{proxy+}');
    eventsProxy.addMethod('ANY', new apigateway.LambdaIntegration(eventsLambda), { authorizer: cognitoAuthorizer });

    // Scores microservice - /scores/*
    const scores = api.root.addResource('scores');
    scores.addMethod('ANY', new apigateway.LambdaIntegration(scoresLambda), { authorizer: cognitoAuthorizer });
    const scoresProxy = scores.addResource('{proxy+}');
    scoresProxy.addMethod('ANY', new apigateway.LambdaIntegration(scoresLambda), { authorizer: cognitoAuthorizer });

    // Exercise Library microservice - /exercises/*
    const exercises = api.root.addResource('exercises');
    exercises.addMethod('ANY', new apigateway.LambdaIntegration(exerciseLibraryLambda), { authorizer: cognitoAuthorizer });
    const exercisesProxy = exercises.addResource('{proxy+}');
    exercisesProxy.addMethod('ANY', new apigateway.LambdaIntegration(exerciseLibraryLambda), { authorizer: cognitoAuthorizer });

    // Leaderboard API - /leaderboard (public endpoint)
    const leaderboard = api.root.addResource('leaderboard');
    leaderboard.addMethod('GET', new apigateway.LambdaIntegration(leaderboardApiLambda));

    // Categories microservice - /categories/*
    const categories = api.root.addResource('categories');
    categories.addMethod('ANY', new apigateway.LambdaIntegration(categoriesLambda), { authorizer: cognitoAuthorizer });
    const categoriesProxy = categories.addResource('{proxy+}');
    categoriesProxy.addMethod('ANY', new apigateway.LambdaIntegration(categoriesLambda), { authorizer: cognitoAuthorizer });

    // WODs microservice - /wods/*
    const wods = api.root.addResource('wods');
    wods.addMethod('ANY', new apigateway.LambdaIntegration(wodsLambda), { authorizer: cognitoAuthorizer });
    const wodsProxy = wods.addResource('{proxy+}');
    wodsProxy.addMethod('ANY', new apigateway.LambdaIntegration(wodsLambda), { authorizer: cognitoAuthorizer });

    // Users microservice - /me/* and /users/* and /athletes/*
    const me = api.root.addResource('me');
    me.addMethod('ANY', new apigateway.LambdaIntegration(usersLambda), { authorizer: cognitoAuthorizer });
    const meProxy = me.addResource('{proxy+}');
    meProxy.addMethod('ANY', new apigateway.LambdaIntegration(usersLambda), { authorizer: cognitoAuthorizer });

    const users = api.root.addResource('users');
    users.addMethod('ANY', new apigateway.LambdaIntegration(usersLambda), { authorizer: cognitoAuthorizer });
    const usersProxy = users.addResource('{proxy+}');
    usersProxy.addMethod('ANY', new apigateway.LambdaIntegration(usersLambda), { authorizer: cognitoAuthorizer });

    // Legacy /athletes route (maps to users Lambda)
    const athletes = api.root.addResource('athletes');
    athletes.addMethod('ANY', new apigateway.LambdaIntegration(usersLambda), { authorizer: cognitoAuthorizer });
    const athletesProxy = athletes.addResource('{proxy+}');
    athletesProxy.addMethod('ANY', new apigateway.LambdaIntegration(usersLambda), { authorizer: cognitoAuthorizer });

    // Sessions microservice - /sessions/*
    const sessions = api.root.addResource('sessions');
    sessions.addMethod('ANY', new apigateway.LambdaIntegration(sessionsLambda), { authorizer: cognitoAuthorizer });
    const sessionsProxy = sessions.addResource('{proxy+}');
    sessionsProxy.addMethod('ANY', new apigateway.LambdaIntegration(sessionsLambda), { authorizer: cognitoAuthorizer });

    // Scheduler microservice - /scheduler/* (DDD scheduler with RBAC)
    const scheduler = api.root.addResource('scheduler');
    scheduler.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'*'"
        }
      }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true
        }
      }]
    });
    scheduler.addMethod('ANY', new apigateway.LambdaIntegration(dddSchedulerLambda), { authorizer: cognitoAuthorizer });
    const schedulerProxy = scheduler.addResource('{proxy+}');
    schedulerProxy.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'*'"
        }
      }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true
        }
      }]
    });
    schedulerProxy.addMethod('ANY', new apigateway.LambdaIntegration(dddSchedulerLambda), { authorizer: cognitoAuthorizer });

    // Analytics microservice - /analytics/*
    const analytics = api.root.addResource('analytics');
    analytics.addMethod('GET', new apigateway.LambdaIntegration(analyticsLambda), { authorizer: cognitoAuthorizer });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'WebsiteUrl', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'EventImagesBucketName', { value: eventImagesBucket.bucketName });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: websiteBucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    
    // DDD Scheduler outputs
    new cdk.CfnOutput(this, 'DDDSchedulerLambdaArn', {
      value: schedulerLambda.functionArn,
      description: 'DDD-compliant Scheduler Lambda ARN'
    });
    new cdk.CfnOutput(this, 'SchedulerEndpoint', {
      value: `${api.url}scheduler/`,
      description: 'DDD Scheduler API endpoint'
    });
    
    new cdk.CfnOutput(this, 'FrontendConfig', {
      value: JSON.stringify({
        apiUrl: api.url,
        userPoolId: userPool.userPoolId,
        userPoolClientId: userPoolClient.userPoolClientId,
        region: this.region,
      }),
    });
  }
}
