"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalisthenicsAppStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const eventbridge = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
const iam = require("aws-cdk-lib/aws-iam");
const stepfunctions = require("aws-cdk-lib/aws-stepfunctions");
const stepfunctionsTasks = require("aws-cdk-lib/aws-stepfunctions-tasks");
const aws_eventbridge_lambda_1 = require("@aws-solutions-constructs/aws-eventbridge-lambda");
class CalisthenicsAppStack extends cdk.Stack {
    constructor(scope, id, props) {
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
            reservedConcurrentExecutions: 10, // Prevent runaway costs
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
        const leaderboardCalculator = new aws_eventbridge_lambda_1.EventbridgeToLambda(this, 'LeaderboardCalculator', {
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
                throttlingBurstLimit: 100, // Max concurrent requests
                throttlingRateLimit: 50, // Requests per second
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
exports.CalisthenicsAppStack = CalisthenicsAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsaXN0aGVuaWNzLWFwcC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNhbGlzdGhlbmljcy1hcHAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLG1EQUFtRDtBQUNuRCxxREFBcUQ7QUFDckQsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCx5Q0FBeUM7QUFDekMseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCxzREFBc0Q7QUFDdEQsMERBQTBEO0FBQzFELDJDQUEyQztBQUUzQywrREFBK0Q7QUFDL0QsMEVBQTBFO0FBQzFFLDZGQUF1RjtBQUd2RixNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsdUNBQXVDO1FBQ3ZDLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDbEUsWUFBWSxFQUFFLG9CQUFvQjtZQUNsQyxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDOUIsa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtnQkFDeEMsU0FBUyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2dCQUM1QyxVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDOUM7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDaEIsSUFBSSxFQUFFLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxrQ0FBa0M7Z0JBQy9HLFFBQVEsRUFBRSxJQUFJLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsa0NBQWtDO2dCQUNuSCxZQUFZLEVBQUUsSUFBSSxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLG9CQUFvQjtnQkFDeEcsYUFBYSxFQUFFLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxrREFBa0Q7YUFDekk7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsU0FBUyxFQUFFLENBQUM7Z0JBQ1osZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsYUFBYSxFQUFFLElBQUk7YUFDcEI7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ3BGLFFBQVE7WUFDUixjQUFjLEVBQUUsS0FBSztZQUNyQixTQUFTLEVBQUU7Z0JBQ1QsWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRSxJQUFJO2FBQ2Q7U0FDRixDQUFDLENBQUM7UUFFSCxtRUFBbUU7UUFDbkUsbUZBQW1GO1FBRW5GLHlEQUF5RDtRQUN6RCxNQUFNLFdBQVcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMxRCxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN0RSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBQ0gsV0FBVyxDQUFDLHVCQUF1QixDQUFDO1lBQ2xDLFNBQVMsRUFBRSxjQUFjO1lBQ3pCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3JFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1NBQ3BFLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixNQUFNLGtCQUFrQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDeEUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUM3RSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsOERBQThEO1FBQzlELE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNwRixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzdFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2hFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFDSCx3QkFBd0IsQ0FBQyx1QkFBdUIsQ0FBQztZQUMvQyxTQUFTLEVBQUUsMEJBQTBCO1lBQ3JDLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3JFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7U0FDekUsQ0FBQyxDQUFDO1FBRUgsOERBQThEO1FBQzlELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNsRixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzdFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFDSCx1QkFBdUIsQ0FBQyx1QkFBdUIsQ0FBQztZQUM5QyxTQUFTLEVBQUUsMEJBQTBCO1lBQ3JDLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1NBQ3ZFLENBQUMsQ0FBQztRQUVILDJEQUEyRDtRQUMzRCxNQUFNLG9CQUFvQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDNUUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUNILG9CQUFvQixDQUFDLHVCQUF1QixDQUFDO1lBQzNDLFNBQVMsRUFBRSx3QkFBd0I7WUFDbkMsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDdEUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7U0FDakUsQ0FBQyxDQUFDO1FBRUgsNkNBQTZDO1FBQzdDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUN4RSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNyRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBQ0gsa0JBQWtCLENBQUMsdUJBQXVCLENBQUM7WUFDekMsU0FBUyxFQUFFLHNCQUFzQjtZQUNqQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN0RSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtTQUN2RSxDQUFDLENBQUM7UUFFSCx3Q0FBd0M7UUFDeEMsTUFBTSxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDOUQsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILDhEQUE4RDtRQUM5RCxNQUFNLGNBQWMsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ2hFLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3RFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQy9ELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxrQ0FBa0M7UUFDbEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUNsRSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN0RSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNwRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsNEJBQTRCO1FBQzVCLE1BQU0sU0FBUyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ3RELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3RFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQy9ELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCx1RUFBdUU7UUFDdkUsTUFBTSxXQUFXLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDMUQsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDdEUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsRUFBRSwwQkFBMEI7WUFDN0YsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUNILFdBQVcsQ0FBQyx1QkFBdUIsQ0FBQztZQUNsQyxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3BFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1NBQ2hFLENBQUMsQ0FBQztRQUVILDhEQUE4RDtRQUM5RCxNQUFNLG1CQUFtQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDMUUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDdEUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN6RSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsdURBQXVEO1FBQ3ZELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM1RSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN6RSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsd0RBQXdEO1FBQ3hELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUM5RSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUM1RSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDeEMsbUJBQW1CLEVBQUUsS0FBSztTQUMzQixDQUFDLENBQUM7UUFDSCxxQkFBcUIsQ0FBQyx1QkFBdUIsQ0FBQztZQUM1QyxTQUFTLEVBQUUsMEJBQTBCO1lBQ3JDLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1NBQ3ZFLENBQUMsQ0FBQztRQUVILG9EQUFvRDtRQUNwRCxNQUFNLGFBQWEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM5RCxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN4RSxtQkFBbUIsRUFBRSxLQUFLO1lBQzFCLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFDSCxhQUFhLENBQUMsdUJBQXVCLENBQUM7WUFDcEMsU0FBUyxFQUFFLGNBQWM7WUFDekIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRztTQUM1QyxDQUFDLENBQUM7UUFFSCwwQ0FBMEM7UUFDMUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNoRSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN0RSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNwRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsNkNBQTZDO1FBQzdDLE1BQU0sVUFBVSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3hELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3pFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2hFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxtREFBbUQ7UUFDbkQsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ3hGLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3RFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2xFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxpQ0FBaUM7UUFDakMsTUFBTSxhQUFhLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDekQsVUFBVSxFQUFFLG9CQUFvQixJQUFJLENBQUMsT0FBTyxFQUFFO1lBQzlDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDeEMsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztTQUNsRCxDQUFDLENBQUM7UUFFSCw2QkFBNkI7UUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ2pFLFVBQVUsRUFBRSw2QkFBNkIsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUN2RCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsSUFBSSxFQUFFO2dCQUNKO29CQUNFLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO29CQUM3RSxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7b0JBQ3JCLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztpQkFDdEI7YUFDRjtZQUNELGdCQUFnQixFQUFFLElBQUk7WUFDdEIsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVU7U0FDbkQsQ0FBQyxDQUFDO1FBRUgsNkRBQTZEO1FBQzdELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxVQUFVLENBQUMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtZQUM3RSx5QkFBeUIsRUFBRTtnQkFDekIsSUFBSSxFQUFFLHNCQUFzQjtnQkFDNUIsV0FBVyxFQUFFLDBCQUEwQjtnQkFDdkMsNkJBQTZCLEVBQUUsSUFBSTtnQkFDbkMsZUFBZSxFQUFFLFFBQVE7Z0JBQ3pCLGVBQWUsRUFBRSxPQUFPO2FBQ3pCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLE1BQU0sWUFBWSxHQUFHLElBQUksVUFBVSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3JFLGVBQWUsRUFBRTtnQkFDZixNQUFNLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyx1QkFBdUIsQ0FBQyxhQUFhLENBQUM7Z0JBQ3JFLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUI7YUFDeEU7WUFDRCxpQkFBaUIsRUFBRSxZQUFZO1lBQy9CLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxVQUFVLEVBQUUsR0FBRztvQkFDZixrQkFBa0IsRUFBRSxHQUFHO29CQUN2QixnQkFBZ0IsRUFBRSxhQUFhO2lCQUNoQztnQkFDRDtvQkFDRSxVQUFVLEVBQUUsR0FBRztvQkFDZixrQkFBa0IsRUFBRSxHQUFHO29CQUN2QixnQkFBZ0IsRUFBRSxhQUFhO2lCQUNoQzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgseURBQXlEO1FBQ3pELGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDeEQsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDO1lBQ3pCLFNBQVMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDN0MsVUFBVSxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsMEJBQTBCLENBQUMsQ0FBQztZQUNsRSxVQUFVLEVBQUU7Z0JBQ1YsWUFBWSxFQUFFO29CQUNaLGVBQWUsRUFBRSx1QkFBdUIsSUFBSSxDQUFDLE9BQU8saUJBQWlCLFlBQVksQ0FBQyxjQUFjLEVBQUU7aUJBQ25HO2FBQ0Y7U0FDRixDQUFDLENBQUMsQ0FBQztRQUVKLDRDQUE0QztRQUM1QyxNQUFNLFNBQVMsR0FBRztZQUNoQixZQUFZLEVBQUUsUUFBUSxDQUFDLFVBQVU7U0FDbEMsQ0FBQztRQUVGLHdCQUF3QjtRQUN4QixNQUFNLG1CQUFtQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0UsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsdUJBQXVCO1lBQ2hDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsQ0FBQztZQUNuRCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsV0FBVyxFQUFFO2dCQUNYLEdBQUcsU0FBUztnQkFDWixtQkFBbUIsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTO2dCQUNqRCwwQkFBMEIsRUFBRSx3QkFBd0IsQ0FBQyxTQUFTO2dCQUM5RCx5QkFBeUIsRUFBRSx1QkFBdUIsQ0FBQyxTQUFTO2FBQzdEO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsa0JBQWtCLENBQUMsa0JBQWtCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUMzRCx3QkFBd0IsQ0FBQyxrQkFBa0IsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2pFLHVCQUF1QixDQUFDLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFaEUsa0RBQWtEO1FBQ2xELG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDMUQsT0FBTyxFQUFFLENBQUMsMEJBQTBCLENBQUM7WUFDckMsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztTQUNsQyxDQUFDLENBQUMsQ0FBQztRQUVKLDBFQUEwRTtRQUMxRSxNQUFNLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDekUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUM7WUFDbEQsVUFBVSxFQUFFLEdBQUc7WUFDZixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFdBQVcsRUFBRSx3REFBd0Q7WUFDckUsV0FBVyxFQUFFO2dCQUNYLEdBQUcsU0FBUztnQkFDWixZQUFZLEVBQUUsV0FBVyxDQUFDLFNBQVM7Z0JBQ25DLHlCQUF5QixFQUFFLHVCQUF1QixDQUFDLFNBQVM7Z0JBQzVELDBCQUEwQixFQUFFLHdCQUF3QixDQUFDLFNBQVM7Z0JBQzlELG1CQUFtQixFQUFFLGlCQUFpQixDQUFDLFVBQVU7YUFDbEQ7U0FDRixDQUFDLENBQUM7UUFDSCxXQUFXLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUNuRCx1QkFBdUIsQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQy9ELHdCQUF3QixDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsOEJBQThCO1FBQzFGLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRS9DLCtEQUErRDtRQUMvRCxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3pELE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO1lBQzdCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLHFCQUFxQjtRQUNyQixNQUFNLFlBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUM3RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxnQkFBZ0I7WUFDekIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDO1lBQ2xELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxTQUFTO2dCQUMxQyxtQkFBbUIsRUFBRSxpQkFBaUIsQ0FBQyxVQUFVO2dCQUNqRCwyQkFBMkIsRUFBRSxFQUFFLEVBQUUsb0RBQW9EO2FBQ3RGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsY0FBYyxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2hELGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUUvQyxpQkFBaUI7UUFDakIsTUFBTSxZQUFZLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDN0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7WUFDN0MsVUFBVSxFQUFFLEdBQUc7WUFDZixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFdBQVcsRUFBRSw2Q0FBNkM7WUFDMUQsV0FBVyxFQUFFO2dCQUNYLEdBQUcsU0FBUztnQkFDWixZQUFZLEVBQUUsV0FBVyxDQUFDLFNBQVM7Z0JBQ25DLGNBQWMsRUFBRSxhQUFhLENBQUMsU0FBUztnQkFDdkMscUJBQXFCLEVBQUUsbUJBQW1CLENBQUMsU0FBUztnQkFDcEQseUJBQXlCLEVBQUUsdUJBQXVCLENBQUMsU0FBUztnQkFDNUQsMEJBQTBCLEVBQUUsd0JBQXdCLENBQUMsU0FBUzthQUMvRDtTQUNGLENBQUMsQ0FBQztRQUNILFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM3QyxhQUFhLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzFDLG1CQUFtQixDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNoRCx1QkFBdUIsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDcEQsd0JBQXdCLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3JELFlBQVksQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ25ELE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO1lBQzdCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLDBCQUEwQjtRQUMxQixNQUFNLG9CQUFvQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDN0UsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsaUJBQWlCO1lBQzFCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUM3QyxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsV0FBVyxFQUFFO2dCQUNYLEdBQUcsU0FBUztnQkFDWixxQkFBcUIsRUFBRSxtQkFBbUIsQ0FBQyxTQUFTO2FBQ3JEO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsbUJBQW1CLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUU3RCxpRUFBaUU7UUFDakUsWUFBWSxDQUFDLGNBQWMsQ0FBQyw2QkFBNkIsRUFBRSxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM5RixvQkFBb0IsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFL0MsMkJBQTJCO1FBQzNCLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSwwQkFBMEI7WUFDbkMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO1lBQzdDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLHNCQUFzQixFQUFFLG9CQUFvQixDQUFDLFNBQVM7YUFDdkQ7U0FDRixDQUFDLENBQUM7UUFDSCxvQkFBb0IsQ0FBQyxrQkFBa0IsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRS9ELDBEQUEwRDtRQUMxRCxNQUFNLHFCQUFxQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0UsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsMEJBQTBCO1lBQ25DLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUM3QyxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsV0FBVyxFQUFFO2dCQUNYLEdBQUcsU0FBUzthQUNiO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM3RSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSx5QkFBeUI7WUFDbEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO1lBQzdDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLGlCQUFpQixFQUFFLHFCQUFxQixDQUFDLFNBQVM7Z0JBQ2xELFlBQVksRUFBRSxXQUFXLENBQUMsU0FBUzthQUNwQztTQUNGLENBQUMsQ0FBQztRQUNILHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzFELFdBQVcsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUVoRCxxQkFBcUI7UUFDckIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ3JFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDO1lBQ2hELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUUsaURBQWlEO1lBQzlELFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLFNBQVM7Z0JBQzNDLHlCQUF5QixFQUFFLHVCQUF1QixDQUFDLFNBQVM7Z0JBQzVELDBCQUEwQixFQUFFLHdCQUF3QixDQUFDLFNBQVM7YUFDL0Q7U0FDRixDQUFDLENBQUM7UUFDSCxlQUFlLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNyRCx1QkFBdUIsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN4RCx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUV6RCxlQUFlO1FBQ2YsTUFBTSxVQUFVLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDekQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDO1lBQzFDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUUsMkRBQTJEO1lBQ3hFLFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osVUFBVSxFQUFFLFNBQVMsQ0FBQyxTQUFTO2dCQUMvQix5QkFBeUIsRUFBRSx1QkFBdUIsQ0FBQyxTQUFTO2dCQUM1RCwwQkFBMEIsRUFBRSx3QkFBd0IsQ0FBQyxTQUFTO2dCQUM5RCxZQUFZLEVBQUUsV0FBVyxDQUFDLFNBQVM7YUFDcEM7U0FDRixDQUFDLENBQUM7UUFDSCxTQUFTLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDekMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xELHdCQUF3QixDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuRCxXQUFXLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXRDLGdCQUFnQjtRQUNoQixNQUFNLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMzRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQztZQUM5QyxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsNEJBQTRCLEVBQUUsRUFBRSxFQUFHLHdCQUF3QjtZQUMzRCxXQUFXLEVBQUUsK0NBQStDO1lBQzVELFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osY0FBYyxFQUFFLGFBQWEsQ0FBQyxTQUFTO2dCQUN2QyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTO2dCQUNsRCwwQkFBMEIsRUFBRSx3QkFBd0IsQ0FBQyxTQUFTO2FBQy9EO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsYUFBYSxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzlDLGtCQUFrQixDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ25ELHdCQUF3QixDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUVwRCxvQkFBb0I7UUFDcEIsTUFBTSxlQUFlLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUNuRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxtQkFBbUI7WUFDNUIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQztZQUM1QyxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsNEJBQTRCLEVBQUUsQ0FBQztZQUMvQixXQUFXLEVBQUUsb0RBQW9EO1lBQ2pFLFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osWUFBWSxFQUFFLFdBQVcsQ0FBQyxTQUFTO2dCQUNuQyxjQUFjLEVBQUUsYUFBYSxDQUFDLFNBQVM7Z0JBQ3ZDLG9CQUFvQixFQUFFLGtCQUFrQixDQUFDLFNBQVM7Z0JBQ2xELGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxTQUFTO2dCQUMzQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFNBQVM7Z0JBQy9CLFlBQVksRUFBRSxXQUFXLENBQUMsU0FBUztnQkFDbkMseUJBQXlCLEVBQUUsdUJBQXVCLENBQUMsU0FBUztnQkFDNUQsMEJBQTBCLEVBQUUsd0JBQXdCLENBQUMsU0FBUzthQUMvRDtTQUNGLENBQUMsQ0FBQztRQUNILFdBQVcsQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDM0MsYUFBYSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUM3QyxrQkFBa0IsQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbEQsZUFBZSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMvQyxTQUFTLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pDLFdBQVcsQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDM0MsdUJBQXVCLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3ZELHdCQUF3QixDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUV4RCxtQkFBbUI7UUFDbkIsTUFBTSxjQUFjLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNqRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxrQkFBa0I7WUFDM0IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDO1lBQ2hELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyw0QkFBNEIsRUFBRSxFQUFFO1lBQ2hDLFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osY0FBYyxFQUFFLGFBQWEsQ0FBQyxTQUFTO2FBQ3hDO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsYUFBYSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRWpELHVDQUF1QztRQUN2QyxNQUFNLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDekUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsd0JBQXdCO1lBQ2pDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUM7WUFDNUMsVUFBVSxFQUFFLEdBQUc7WUFDZixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osWUFBWSxFQUFFLFdBQVcsQ0FBQyxTQUFTO2dCQUNuQyxnQkFBZ0IsRUFBRSxjQUFjLENBQUMsU0FBUzthQUMzQztTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSwyQkFBMkI7WUFDcEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDO1lBQzlDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLGNBQWMsRUFBRSxhQUFhLENBQUMsU0FBUztnQkFDdkMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUMsU0FBUzthQUNuRDtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNuRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSw2QkFBNkI7WUFDdEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDO1lBQ2hELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxTQUFTO2FBQzVDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3ZFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLHVCQUF1QjtZQUNoQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDO1lBQzFDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLFVBQVUsRUFBRSxTQUFTLENBQUMsU0FBUzthQUNoQztTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUNqRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSwyQkFBMkI7WUFDcEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDO1lBQ2xELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNoQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLGVBQWUsRUFBRSxjQUFjLENBQUMsU0FBUzthQUMxQztTQUNGLENBQUMsQ0FBQztRQUVILG9CQUFvQjtRQUNwQixXQUFXLENBQUMsYUFBYSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDOUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2pELGFBQWEsQ0FBQyxhQUFhLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUNuRCxrQkFBa0IsQ0FBQyxhQUFhLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUN4RCxlQUFlLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDdkQsU0FBUyxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzNDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBRTFELGtDQUFrQztRQUNsQyxNQUFNLGdCQUFnQixHQUFHLElBQUksa0JBQWtCLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUNyRixjQUFjLEVBQUUsa0JBQWtCO1lBQ2xDLFVBQVUsRUFBRSxlQUFlO1NBQzVCLENBQUMsQ0FBQztRQUVILE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzNGLGNBQWMsRUFBRSxxQkFBcUI7WUFDckMsVUFBVSxFQUFFLGtCQUFrQjtTQUMvQixDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksa0JBQWtCLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRixjQUFjLEVBQUUsdUJBQXVCO1lBQ3ZDLFVBQVUsRUFBRSxvQkFBb0I7U0FDakMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ25GLGNBQWMsRUFBRSxpQkFBaUI7WUFDakMsVUFBVSxFQUFFLGNBQWM7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDN0YsY0FBYyxFQUFFLHNCQUFzQjtZQUN0QyxPQUFPLEVBQUUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUM7Z0JBQzFDLFdBQVcsRUFBRSxjQUFjO2dCQUMzQixVQUFVLEVBQUUsYUFBYTtnQkFDekIsYUFBYSxFQUFFLG9DQUFvQztnQkFDbkQsUUFBUSxFQUFFLCtCQUErQjtnQkFDekMsWUFBWSxFQUFFLHNDQUFzQztnQkFDcEQsY0FBYyxFQUFFLDBDQUEwQztnQkFDMUQsUUFBUSxFQUFFLDhCQUE4QjthQUN6QyxDQUFDO1lBQ0YsVUFBVSxFQUFFLFdBQVc7U0FDeEIsQ0FBQyxDQUFDO1FBRUgsMkJBQTJCO1FBQzNCLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsQ0FBQzthQUN0RixNQUFNLENBQUMsZ0JBQWdCLENBQUM7YUFDeEIsTUFBTSxDQUFDLG1CQUFtQixDQUFDO2FBQzNCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQzthQUM3QixNQUFNLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFM0IsTUFBTSxpQkFBaUIsR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUU1RSx3QkFBd0I7UUFDeEIsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLGFBQWEsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQzFGLGNBQWMsRUFBRSxhQUFhLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQztZQUM3RSxnQkFBZ0IsRUFBRSxhQUFhLENBQUMsZ0JBQWdCLENBQUMsT0FBTztZQUN4RCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ2pDLENBQUMsQ0FBQztRQUVILGlDQUFpQztRQUNqQyxNQUFNLGVBQWUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ25FLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGlDQUFpQztZQUMxQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUM7WUFDbEQsVUFBVSxFQUFFLEdBQUc7WUFDZixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFdBQVcsRUFBRSxvREFBb0Q7WUFDakUsV0FBVyxFQUFFO2dCQUNYLEdBQUcsU0FBUztnQkFDWixlQUFlLEVBQUUsY0FBYyxDQUFDLFNBQVM7Z0JBQ3pDLDJCQUEyQixFQUFFLHFCQUFxQixDQUFDLGVBQWU7YUFDbkU7U0FDRixDQUFDLENBQUM7UUFFSCw4REFBOEQ7UUFDOUQsY0FBYyxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRW5ELDRDQUE0QztRQUM1QyxxQkFBcUIsQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUUvRCxrREFBa0Q7UUFDbEQsZUFBZSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztZQUM3QixTQUFTLEVBQUUsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxvQkFBb0IsQ0FBQztTQUMvRSxDQUFDLENBQUMsQ0FBQztRQUVKLGdFQUFnRTtRQUNoRSxNQUFNLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDekUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUscUJBQXFCO1lBQzlCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQztZQUNoRCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsV0FBVyxFQUFFLDRDQUE0QztZQUN6RCxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLGVBQWUsRUFBRSxjQUFjLENBQUMsU0FBUztnQkFDekMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxTQUFTO2dCQUNqQyw0QkFBNEIsRUFBRSwwQkFBMEIsQ0FBQyxTQUFTO2dCQUNsRSx5QkFBeUIsRUFBRSx1QkFBdUIsQ0FBQyxTQUFTO2dCQUM1RCwwQkFBMEIsRUFBRSx3QkFBd0IsQ0FBQyxTQUFTO2FBQy9EO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsc0NBQXNDO1FBQ3RDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3RELFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2xELDBCQUEwQixDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDbEUsdUJBQXVCLENBQUMsYUFBYSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDMUQsd0JBQXdCLENBQUMsYUFBYSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFM0QsMEZBQTBGO1FBQzFGLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSw4QkFBOEI7WUFDdkMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDO1lBQ2xELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUUsd0RBQXdEO1lBQ3JFLFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osZUFBZSxFQUFFLGNBQWMsQ0FBQyxTQUFTO2FBQzFDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsY0FBYyxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRXBELHVDQUF1QztRQUN2QyxNQUFNLHdCQUF3QixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDckYsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsb0NBQW9DO1lBQzdDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQztZQUNsRCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsV0FBVyxFQUFFLHdDQUF3QztZQUNyRCxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxTQUFTO2dCQUNaLFlBQVksRUFBRSxXQUFXLENBQUMsU0FBUztnQkFDbkMsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLFNBQVM7Z0JBQzFDLGNBQWMsRUFBRSxTQUFTO2FBQzFCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsV0FBVyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQ3BELGNBQWMsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUN2RCx3QkFBd0IsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQy9ELE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO1lBQzdCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUN6RixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxzQ0FBc0M7WUFDL0MsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDO1lBQ2xELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUUsMENBQTBDO1lBQ3ZELFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osY0FBYyxFQUFFLGFBQWEsQ0FBQyxTQUFTO2dCQUN2QyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTO2dCQUNsRCxjQUFjLEVBQUUsU0FBUzthQUMxQjtTQUNGLENBQUMsQ0FBQztRQUVILGFBQWEsQ0FBQyxhQUFhLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUN4RCxrQkFBa0IsQ0FBQyxhQUFhLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUM3RCwwQkFBMEIsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ2pFLE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO1lBQzdCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSw4QkFBOEIsRUFBRTtZQUM3RixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSx3Q0FBd0M7WUFDakQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDO1lBQ2xELFVBQVUsRUFBRSxHQUFHO1lBQ2YsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUUsNENBQTRDO1lBQ3pELFdBQVcsRUFBRTtnQkFDWCxHQUFHLFNBQVM7Z0JBQ1osZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLFNBQVM7Z0JBQzNDLGNBQWMsRUFBRSxTQUFTO2FBQzFCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsZUFBZSxDQUFDLGFBQWEsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQzVELDRCQUE0QixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDbkUsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7WUFDN0IsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FBQyxDQUFDO1FBRUosTUFBTSxzQkFBc0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ2pGLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGtDQUFrQztZQUMzQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUM7WUFDbEQsVUFBVSxFQUFFLEdBQUc7WUFDZixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFdBQVcsRUFBRSxzQ0FBc0M7WUFDbkQsV0FBVyxFQUFFO2dCQUNYLEdBQUcsU0FBUztnQkFDWixVQUFVLEVBQUUsU0FBUyxDQUFDLFNBQVM7Z0JBQy9CLGNBQWMsRUFBRSxTQUFTO2FBQzFCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ2hELHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDN0QsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7WUFDN0IsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FBQyxDQUFDO1FBRUosOENBQThDO1FBQzlDLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRTNGLHNEQUFzRDtRQUN0RCxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ2pELFFBQVE7WUFDUixZQUFZLEVBQUU7Z0JBQ1osTUFBTSxFQUFFLENBQUMsd0JBQXdCLENBQUM7Z0JBQ2xDLFVBQVUsRUFBRSxDQUFDLHNCQUFzQixDQUFDO2FBQ3JDO1lBQ0QsT0FBTyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLENBQUM7U0FDaEUsQ0FBQyxDQUFDO1FBRUgsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNwRCxRQUFRO1lBQ1IsWUFBWSxFQUFFO2dCQUNaLE1BQU0sRUFBRSxDQUFDLHdCQUF3QixDQUFDO2dCQUNsQyxVQUFVLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQzthQUN4QztZQUNELE9BQU8sRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1NBQ2xFLENBQUMsQ0FBQztRQUVILElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDdEQsUUFBUTtZQUNSLFlBQVksRUFBRTtnQkFDWixNQUFNLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQztnQkFDbEMsVUFBVSxFQUFFLENBQUMsMkJBQTJCLENBQUM7YUFDMUM7WUFDRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsNEJBQTRCLENBQUMsQ0FBQztTQUNwRSxDQUFDLENBQUM7UUFFSCxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ2hELFFBQVE7WUFDUixZQUFZLEVBQUU7Z0JBQ1osTUFBTSxFQUFFLENBQUMsd0JBQXdCLENBQUM7Z0JBQ2xDLFVBQVUsRUFBRSxDQUFDLHFCQUFxQixDQUFDO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLHNCQUFzQixDQUFDLENBQUM7U0FDOUQsQ0FBQyxDQUFDO1FBRUgsNERBQTREO1FBQzVELElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDaEQsUUFBUTtZQUNSLFlBQVksRUFBRTtnQkFDWixNQUFNLEVBQUUsQ0FBQyxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUsYUFBYSxDQUFDO2dCQUNoRixVQUFVLEVBQUUsQ0FBQyxxQkFBcUIsRUFBRSx3QkFBd0IsRUFBRSwwQkFBMEIsRUFBRSxvQkFBb0IsQ0FBQzthQUNoSDtZQUNELE9BQU8sRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQztTQUN2RCxDQUFDLENBQUM7UUFFSCxxREFBcUQ7UUFDckQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLDRDQUFtQixDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNuRixtQkFBbUIsRUFBRTtnQkFDbkIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztnQkFDbkMsT0FBTyxFQUFFLHlDQUF5QztnQkFDbEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsR0FBRztnQkFDZixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNoQyxXQUFXLEVBQUU7b0JBQ1gsWUFBWSxFQUFFLFdBQVcsQ0FBQyxTQUFTO29CQUNuQyxpQkFBaUIsRUFBRSxxQkFBcUIsQ0FBQyxTQUFTO2lCQUNuRDthQUNGO1lBQ0QsY0FBYyxFQUFFO2dCQUNkLFlBQVksRUFBRTtvQkFDWixNQUFNLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztvQkFDOUIsVUFBVSxFQUFFLENBQUMsaUJBQWlCLENBQUM7aUJBQ2hDO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxXQUFXLENBQUMsYUFBYSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2hFLHFCQUFxQixDQUFDLGtCQUFrQixDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRS9FLHlDQUF5QztRQUN6QyxNQUFNLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzFELFdBQVcsRUFBRSw4QkFBOEI7WUFDM0MsYUFBYSxFQUFFO2dCQUNiLG9CQUFvQixFQUFFLEdBQUcsRUFBRywwQkFBMEI7Z0JBQ3RELG1CQUFtQixFQUFFLEVBQUUsRUFBSyxzQkFBc0I7Z0JBQ2xELFlBQVksRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsSUFBSTtnQkFDaEQsZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsY0FBYyxFQUFFLElBQUk7YUFDckI7WUFDRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLENBQUMsY0FBYyxFQUFFLGVBQWUsQ0FBQzthQUNoRDtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0saUJBQWlCLEdBQUcsSUFBSSxVQUFVLENBQUMsMEJBQTBCLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzdGLGdCQUFnQixFQUFFLENBQUMsUUFBUSxDQUFDO1NBQzdCLENBQUMsQ0FBQztRQUVILDJFQUEyRTtRQUMzRSxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0RCxNQUFNLFlBQVksR0FBRyxjQUFjLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFELFlBQVksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUNwRixNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0QsaUJBQWlCLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7UUFFekYsaUZBQWlGO1FBQ2pGLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDaEUsZUFBZSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO1FBQzFGLE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNyRSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztRQUUvRixpRUFBaUU7UUFDakUsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMxRCxZQUFZLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBRTlFLDhEQUE4RDtRQUM5RCxNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUMxRCxZQUFZLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUN2SCxNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0QsaUJBQWlCLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUU1SCxnREFBZ0Q7UUFDaEQsTUFBTSxhQUFhLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDNUQsYUFBYSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDekgsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2pFLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFFOUgsa0NBQWtDO1FBQ2xDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUMzRyxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25ELFdBQVcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUVoSCxrQ0FBa0M7UUFDbEMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQzNHLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbkQsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRWhILCtDQUErQztRQUMvQyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwRCxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUN2SCxNQUFNLGNBQWMsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pELGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRTVILG1EQUFtRDtRQUNuRCxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN4RCxXQUFXLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFFckYsMENBQTBDO1FBQzFDLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3RELFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQ25ILE1BQU0sZUFBZSxHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0QsZUFBZSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFFeEgsOEJBQThCO1FBQzlCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUN2RyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9DLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUU1RywwREFBMEQ7UUFDMUQsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQ3RHLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0MsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRTNHLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUN6RyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2pELFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUU5RyxnREFBZ0Q7UUFDaEQsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbEQsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQzVHLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdkQsYUFBYSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRWpILHNDQUFzQztRQUN0QyxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsRCxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDL0csTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN2RCxhQUFhLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFFcEgsa0VBQWtFO1FBQ2xFLE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BELFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLElBQUksVUFBVSxDQUFDLGVBQWUsQ0FBQztZQUM1RCxvQkFBb0IsRUFBRSxDQUFDO29CQUNyQixVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2xCLHFEQUFxRCxFQUFFLDhCQUE4Qjt3QkFDckYscURBQXFELEVBQUUsK0JBQStCO3dCQUN0RixvREFBb0QsRUFBRSxLQUFLO3FCQUM1RDtpQkFDRixDQUFDO1lBQ0YsZ0JBQWdCLEVBQUU7Z0JBQ2hCLGtCQUFrQixFQUFFLHFCQUFxQjthQUMxQztTQUNGLENBQUMsRUFBRTtZQUNGLGVBQWUsRUFBRSxDQUFDO29CQUNoQixVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2xCLHFEQUFxRCxFQUFFLElBQUk7d0JBQzNELHFEQUFxRCxFQUFFLElBQUk7d0JBQzNELG9EQUFvRCxFQUFFLElBQUk7cUJBQzNEO2lCQUNGLENBQUM7U0FDSCxDQUFDLENBQUM7UUFDSCxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUNwSCxNQUFNLGNBQWMsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pELGNBQWMsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLElBQUksVUFBVSxDQUFDLGVBQWUsQ0FBQztZQUNqRSxvQkFBb0IsRUFBRSxDQUFDO29CQUNyQixVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2xCLHFEQUFxRCxFQUFFLDhCQUE4Qjt3QkFDckYscURBQXFELEVBQUUsK0JBQStCO3dCQUN0RixvREFBb0QsRUFBRSxLQUFLO3FCQUM1RDtpQkFDRixDQUFDO1lBQ0YsZ0JBQWdCLEVBQUU7Z0JBQ2hCLGtCQUFrQixFQUFFLHFCQUFxQjthQUMxQztTQUNGLENBQUMsRUFBRTtZQUNGLGVBQWUsRUFBRSxDQUFDO29CQUNoQixVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2xCLHFEQUFxRCxFQUFFLElBQUk7d0JBQzNELHFEQUFxRCxFQUFFLElBQUk7d0JBQzNELG9EQUFvRCxFQUFFLElBQUk7cUJBQzNEO2lCQUNGLENBQUM7U0FDSCxDQUFDLENBQUM7UUFDSCxjQUFjLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUV6SCx3Q0FBd0M7UUFDeEMsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDcEQsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRWpILFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUN0RSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLGNBQWMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7UUFDeEYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdEQsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxDQUFDLHNCQUFzQixFQUFFLENBQUMsQ0FBQztRQUN0RixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDMUYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRSxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUNuRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEVBQUUsS0FBSyxFQUFFLFlBQVksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO1FBRWxGLHdCQUF3QjtRQUN4QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxlQUFlLENBQUMsV0FBVztZQUNsQyxXQUFXLEVBQUUsb0NBQW9DO1NBQ2xELENBQUMsQ0FBQztRQUNILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsWUFBWTtZQUM3QixXQUFXLEVBQUUsNEJBQTRCO1NBQzFDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRztnQkFDZixVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVU7Z0JBQy9CLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxnQkFBZ0I7Z0JBQ2pELE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTthQUNwQixDQUFDO1NBQ0gsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbGtDRCxvREFra0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGV2ZW50YnJpZGdlIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgc3RlcGZ1bmN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgKiBhcyBzdGVwZnVuY3Rpb25zVGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgRXZlbnRicmlkZ2VUb0xhbWJkYSB9IGZyb20gJ0Bhd3Mtc29sdXRpb25zLWNvbnN0cnVjdHMvYXdzLWV2ZW50YnJpZGdlLWxhbWJkYSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIENhbGlzdGhlbmljc0FwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgZm9yIGF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnQ2FsaXN0aGVuaWNzVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6ICdjYWxpc3RoZW5pY3MtdXNlcnMnLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH0sXG4gICAgICAgIGZhbWlseU5hbWU6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgIHJvbGU6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG1pbkxlbjogMSwgbWF4TGVuOiAyMCwgbXV0YWJsZTogdHJ1ZSB9KSwgLy8gTGVnYWN5IC0ga2VwdCBmb3IgY29tcGF0aWJpbGl0eVxuICAgICAgICBkaXZpc2lvbjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbWluTGVuOiAxLCBtYXhMZW46IDUwLCBtdXRhYmxlOiB0cnVlIH0pLCAvLyBMZWdhY3kgLSBrZXB0IGZvciBjb21wYXRpYmlsaXR5XG4gICAgICAgIGlzU3VwZXJBZG1pbjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbWluTGVuOiAxLCBtYXhMZW46IDUsIG11dGFibGU6IHRydWUgfSksIC8vICd0cnVlJyBvciAnZmFsc2UnXG4gICAgICAgIG9yZ2FuaXplclJvbGU6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG1pbkxlbjogMSwgbWF4TGVuOiAyMCwgbXV0YWJsZTogdHJ1ZSB9KSwgLy8gJ3N1cGVyX2FkbWluJywgJ2V2ZW50X2FkbWluJywgJ2F1eGlsaWFyeV9hZG1pbidcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnQ2FsaXN0aGVuaWNzVXNlclBvb2xDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGVzIC0gTXVsdGktdGVuYW50IGFyY2hpdGVjdHVyZSB3aXRoIGV2ZW50IGlzb2xhdGlvblxuICAgIC8vIFVzaW5nIE9uLURlbWFuZCBiaWxsaW5nIGZvciBjb3N0IG9wdGltaXphdGlvbiBhbmQgdW5wcmVkaWN0YWJsZSB0cmFmZmljIHBhdHRlcm5zXG4gICAgXG4gICAgLy8gRXZlbnRzIHRhYmxlIC0gTWFpbiBldmVudHMgKGUuZy4sIFwiU3VtbWVyIEdhbWVzIDIwMjVcIilcbiAgICBjb25zdCBldmVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRXZlbnRzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgZXZlbnRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnc3RhdHVzLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc3RhdHVzJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3N0YXJ0RGF0ZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBPcmdhbml6YXRpb25zIHRhYmxlXG4gICAgY29uc3Qgb3JnYW5pemF0aW9uc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdPcmdhbml6YXRpb25zVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yZ2FuaXphdGlvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gT3JnYW5pemF0aW9uIE1lbWJlcnMgKG1hbnktdG8tbWFueTogdXNlcnMgdG8gb3JnYW5pemF0aW9ucylcbiAgICBjb25zdCBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ09yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnb3JnYW5pemF0aW9uSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VyLW9yZ2FuaXphdGlvbnMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnb3JnYW5pemF0aW9uSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gT3JnYW5pemF0aW9uLUV2ZW50IG1hcHBpbmcgKGV2ZW50cyBiZWxvbmcgdG8gb3JnYW5pemF0aW9ucylcbiAgICBjb25zdCBvcmdhbml6YXRpb25FdmVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnT3JnYW5pemF0aW9uRXZlbnRzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yZ2FuaXphdGlvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgb3JnYW5pemF0aW9uRXZlbnRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZXZlbnQtb3JnYW5pemF0aW9uLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMZWdhY3k6IEtlZXAgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgZHVyaW5nIG1pZ3JhdGlvblxuICAgIGNvbnN0IG9yZ2FuaXplckV2ZW50c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdPcmdhbml6ZXJFdmVudHNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgb3JnYW5pemVyRXZlbnRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZXZlbnQtb3JnYW5pemVycy1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIEF0aGxldGUtRXZlbnQgcmVnaXN0cmF0aW9ucyAobWFueS10by1tYW55KVxuICAgIGNvbnN0IGF0aGxldGVFdmVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXRobGV0ZUV2ZW50c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICBhdGhsZXRlRXZlbnRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZXZlbnQtYXRobGV0ZXMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3JlZ2lzdGVyZWRBdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBdGhsZXRlcyB0YWJsZSAtIEdsb2JhbCB1c2VyIHByb2ZpbGVzXG4gICAgY29uc3QgYXRobGV0ZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXRobGV0ZXNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gRXZlbnQgRGF5cyB0YWJsZSAtIEluZGl2aWR1YWwgZGF5cy9zZXNzaW9ucyB3aXRoaW4gYW4gZXZlbnRcbiAgICBjb25zdCBldmVudERheXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRXZlbnREYXlzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZGF5SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDYXRlZ29yaWVzIHRhYmxlIC0gRXZlbnQtc2NvcGVkXG4gICAgY29uc3QgY2F0ZWdvcmllc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDYXRlZ29yaWVzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY2F0ZWdvcnlJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFdPRHMgdGFibGUgLSBFdmVudC1zY29wZWRcbiAgICBjb25zdCB3b2RzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1dvZHNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd3b2RJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFNjb3JlcyB0YWJsZSAtIEV2ZW50LXNjb3BlZCB3aXRoIGNvbXBvc2l0ZSBrZXkgZm9yIGVmZmljaWVudCBxdWVyaWVzXG4gICAgY29uc3Qgc2NvcmVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Njb3Jlc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3Njb3JlSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LCAvLyBGb3JtYXQ6IGRheUlkI2F0aGxldGVJZFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgc2NvcmVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZGF5LXNjb3Jlcy1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2RheUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3Njb3JlJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICB9KTtcblxuICAgIC8vIFNjb3JpbmcgU3lzdGVtcyB0YWJsZSAtIEV2ZW50LXNjb3BlZCBzY29yaW5nIGNvbmZpZ3VyYXRpb25zXG4gICAgY29uc3Qgc2NvcmluZ1N5c3RlbXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU2NvcmluZ1N5c3RlbXNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzY29yaW5nU3lzdGVtSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBFeGVyY2lzZSBMaWJyYXJ5IHRhYmxlIC0gR2xvYmFsIGV4ZXJjaXNlIGRlZmluaXRpb25zXG4gICAgY29uc3QgZXhlcmNpc2VMaWJyYXJ5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0V4ZXJjaXNlTGlicmFyeVRhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdleGVyY2lzZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gTGVhZGVyYm9hcmQgQ2FjaGUgdGFibGUgLSBQcmUtY2FsY3VsYXRlZCBsZWFkZXJib2FyZHNcbiAgICBjb25zdCBsZWFkZXJib2FyZENhY2hlVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0xlYWRlcmJvYXJkQ2FjaGVUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnbGVhZGVyYm9hcmRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgIH0pO1xuICAgIGxlYWRlcmJvYXJkQ2FjaGVUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdldmVudC1sZWFkZXJib2FyZHMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIFNlc3Npb25zIHRhYmxlIC0gVXNlciBzZXNzaW9uIG1hbmFnZW1lbnQgd2l0aCBUVExcbiAgICBjb25zdCBzZXNzaW9uc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTZXNzaW9uc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzZXNzaW9uSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICBzZXNzaW9uc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3VzZXJJZC1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gU2NoZWR1bGVzIHRhYmxlIC0gQ29tcGV0aXRpb24gc2NoZWR1bGVzXG4gICAgY29uc3Qgc2NoZWR1bGVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1NjaGVkdWxlc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3NjaGVkdWxlSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBIZWF0cyB0YWJsZSAtIEluZGl2aWR1YWwgY29tcGV0aXRpb24gaGVhdHNcbiAgICBjb25zdCBoZWF0c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdIZWF0c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzY2hlZHVsZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2hlYXRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENsYXNzaWZpY2F0aW9uIEZpbHRlcnMgdGFibGUgLSBFbGltaW5hdGlvbiBydWxlc1xuICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uRmlsdGVyc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdDbGFzc2lmaWNhdGlvbkZpbHRlcnNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmaWx0ZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgZnJvbnRlbmQgaG9zdGluZ1xuICAgIGNvbnN0IHdlYnNpdGVCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdXZWJzaXRlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGNhbGlzdGhlbmljcy1hcHAtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgfSk7XG5cbiAgICAvLyBTMyBCdWNrZXQgZm9yIGV2ZW50IGltYWdlc1xuICAgIGNvbnN0IGV2ZW50SW1hZ2VzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRXZlbnRJbWFnZXNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgY2FsaXN0aGVuaWNzLWV2ZW50LWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuUE9TVF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FDTFMsXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IE9yaWdpbiBBY2Nlc3MgQ29udHJvbCAoT0FDKSAtIGxhdGVzdCBDREsgc3ludGF4XG4gICAgY29uc3Qgb3JpZ2luQWNjZXNzQ29udHJvbCA9IG5ldyBjbG91ZGZyb250LkNmbk9yaWdpbkFjY2Vzc0NvbnRyb2wodGhpcywgJ09BQycsIHtcbiAgICAgIG9yaWdpbkFjY2Vzc0NvbnRyb2xDb25maWc6IHtcbiAgICAgICAgbmFtZTogJ2NhbGlzdGhlbmljcy1hcHAtb2FjJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdPQUMgZm9yIENhbGlzdGhlbmljcyBBcHAnLFxuICAgICAgICBvcmlnaW5BY2Nlc3NDb250cm9sT3JpZ2luVHlwZTogJ3MzJyxcbiAgICAgICAgc2lnbmluZ0JlaGF2aW9yOiAnYWx3YXlzJyxcbiAgICAgICAgc2lnbmluZ1Byb3RvY29sOiAnc2lndjQnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uXG4gICAgY29uc3QgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdEaXN0cmlidXRpb24nLCB7XG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NDb250cm9sKHdlYnNpdGVCdWNrZXQpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgQ2xvdWRGcm9udCBhY2Nlc3MgdG8gUzMgYnVja2V0IHZpYSBidWNrZXQgcG9saWN5XG4gICAgd2Vic2l0ZUJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICByZXNvdXJjZXM6IFt3ZWJzaXRlQnVja2V0LmFybkZvck9iamVjdHMoJyonKV0sXG4gICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjbG91ZGZyb250LmFtYXpvbmF3cy5jb20nKV0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdBV1M6U291cmNlQXJuJzogYGFybjphd3M6Y2xvdWRmcm9udDo6JHt0aGlzLmFjY291bnR9OmRpc3RyaWJ1dGlvbi8ke2Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZH1gLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KSk7XG5cbiAgICAvLyBNaWNyb3NlcnZpY2VzOiBTZXBhcmF0ZSBMYW1iZGEgcGVyIGRvbWFpblxuICAgIGNvbnN0IGNvbW1vbkVudiA9IHtcbiAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICB9O1xuXG4gICAgLy8gT3JnYW5pemF0aW9ucyBzZXJ2aWNlXG4gICAgY29uc3Qgb3JnYW5pemF0aW9uc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ09yZ2FuaXphdGlvbnNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdvcmdhbml6YXRpb25zLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvb3JnYW5pemF0aW9ucycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBPUkdBTklaQVRJT05TX1RBQkxFOiBvcmdhbml6YXRpb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fTUVNQkVSU19UQUJMRTogb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX0VWRU5UU19UQUJMRTogb3JnYW5pemF0aW9uRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBvcmdhbml6YXRpb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG9yZ2FuaXphdGlvbnNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEob3JnYW5pemF0aW9uc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uRXZlbnRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG9yZ2FuaXphdGlvbnNMYW1iZGEpO1xuICAgIFxuICAgIC8vIEdyYW50IENvZ25pdG8gcGVybWlzc2lvbnMgdG8gZmV0Y2ggdXNlciBkZXRhaWxzXG4gICAgb3JnYW5pemF0aW9uc0xhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydjb2duaXRvLWlkcDpBZG1pbkdldFVzZXInXSxcbiAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXVxuICAgIH0pKTtcblxuICAgIC8vIENvbXBldGl0aW9ucyBzZXJ2aWNlIC0gSGFuZGxlcyBjb21wZXRpdGlvbnMgYW5kIHB1YmxpYyBldmVudHMgZW5kcG9pbnRzXG4gICAgY29uc3QgY29tcGV0aXRpb25zTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29tcGV0aXRpb25zTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jb21wZXRpdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tcGV0aXRpb25zIHNlcnZpY2Ugd2l0aCBwdWJsaWMgZXZlbnRzIGVuZHBvaW50cyAtIHYyJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgRVZFTlRTX1RBQkxFOiBldmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9FVkVOVFNfVEFCTEU6IG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX01FTUJFUlNfVEFCTEU6IG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVWRU5UX0lNQUdFU19CVUNLRVQ6IGV2ZW50SW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGV2ZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjb21wZXRpdGlvbnNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjb21wZXRpdGlvbnNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS5ncmFudFJlYWREYXRhKGNvbXBldGl0aW9uc0xhbWJkYSk7IC8vIFJlYWQtb25seSBmb3IgYXV0aG9yaXphdGlvblxuICAgIGV2ZW50SW1hZ2VzQnVja2V0LmdyYW50UHV0KGNvbXBldGl0aW9uc0xhbWJkYSk7XG4gICAgXG4gICAgLy8gR3JhbnQgRXZlbnRCcmlkZ2UgcGVybWlzc2lvbnMgZm9yIGV2ZW50LWRyaXZlbiBjb21tdW5pY2F0aW9uXG4gICAgY29tcGV0aXRpb25zTGFtYmRhLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gRXZlbnQgRGF5cyBzZXJ2aWNlXG4gICAgY29uc3QgZXZlbnRzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRXZlbnRzTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZXZlbnRzLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY29tcGV0aXRpb25zJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVWRU5UX0RBWVNfVEFCTEU6IGV2ZW50RGF5c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRVZFTlRfSU1BR0VTX0JVQ0tFVDogZXZlbnRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgU0NPUklOR19TWVNURU1TX0xBTUJEQV9OQU1FOiAnJywgLy8gV2lsbCBiZSBzZXQgYWZ0ZXIgc2NvcmluZ1N5c3RlbXNMYW1iZGEgaXMgY3JlYXRlZFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBldmVudERheXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZXZlbnRzTGFtYmRhKTtcbiAgICBldmVudEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZShldmVudHNMYW1iZGEpO1xuXG4gICAgLy8gU2NvcmVzIHNlcnZpY2VcbiAgICBjb25zdCBzY29yZXNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTY29yZXNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3Njb3JpbmcnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2NvcmVzIHNlcnZpY2UgLSB2NSB3aXRoIFJCQUMgYXV0aG9yaXphdGlvbicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNDT1JFU19UQUJMRTogc2NvcmVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBVEhMRVRFU19UQUJMRTogYXRobGV0ZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFNDT1JJTkdfU1lTVEVNU19UQUJMRTogc2NvcmluZ1N5c3RlbXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9FVkVOVFNfVEFCTEU6IG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX01FTUJFUlNfVEFCTEU6IG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNjb3Jlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzY29yZXNMYW1iZGEpO1xuICAgIGF0aGxldGVzVGFibGUuZ3JhbnRSZWFkRGF0YShzY29yZXNMYW1iZGEpO1xuICAgIHNjb3JpbmdTeXN0ZW1zVGFibGUuZ3JhbnRSZWFkRGF0YShzY29yZXNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoc2NvcmVzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShzY29yZXNMYW1iZGEpO1xuICAgIHNjb3Jlc0xhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIFNjb3JpbmcgU3lzdGVtcyBzZXJ2aWNlXG4gICAgY29uc3Qgc2NvcmluZ1N5c3RlbXNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTY29yaW5nU3lzdGVtc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3N5c3RlbXMuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9zY29yaW5nJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNDT1JJTkdfU1lTVEVNU19UQUJMRTogc2NvcmluZ1N5c3RlbXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNjb3JpbmdTeXN0ZW1zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHNjb3JpbmdTeXN0ZW1zTGFtYmRhKTtcbiAgICBcbiAgICAvLyBVcGRhdGUgZXZlbnRzTGFtYmRhIGVudmlyb25tZW50IHdpdGggc2NvcmluZ1N5c3RlbXNMYW1iZGEgbmFtZVxuICAgIGV2ZW50c0xhbWJkYS5hZGRFbnZpcm9ubWVudCgnU0NPUklOR19TWVNURU1TX0xBTUJEQV9OQU1FJywgc2NvcmluZ1N5c3RlbXNMYW1iZGEuZnVuY3Rpb25OYW1lKTtcbiAgICBzY29yaW5nU3lzdGVtc0xhbWJkYS5ncmFudEludm9rZShldmVudHNMYW1iZGEpO1xuXG4gICAgLy8gRXhlcmNpc2UgTGlicmFyeSBzZXJ2aWNlXG4gICAgY29uc3QgZXhlcmNpc2VMaWJyYXJ5TGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRXhlcmNpc2VMaWJyYXJ5TGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZXhlcmNpc2UtbGlicmFyeS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3Njb3JpbmcnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgRVhFUkNJU0VfTElCUkFSWV9UQUJMRTogZXhlcmNpc2VMaWJyYXJ5VGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBleGVyY2lzZUxpYnJhcnlUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZXhlcmNpc2VMaWJyYXJ5TGFtYmRhKTtcblxuICAgIC8vIFNjb3JlIENhbGN1bGF0b3Igc2VydmljZSAoc3RhdGVsZXNzIGNhbGN1bGF0aW9uIGVuZ2luZSlcbiAgICBjb25zdCBzY29yZUNhbGN1bGF0b3JMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTY29yZUNhbGN1bGF0b3JMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzY29yZS1jYWxjdWxhdG9yLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvc2NvcmluZycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIExlYWRlcmJvYXJkIEFQSSBzZXJ2aWNlXG4gICAgY29uc3QgbGVhZGVyYm9hcmRBcGlMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMZWFkZXJib2FyZEFwaUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2xlYWRlcmJvYXJkLWFwaS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3Njb3JpbmcnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgTEVBREVSQk9BUkRfVEFCTEU6IGxlYWRlcmJvYXJkQ2FjaGVUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFNDT1JFU19UQUJMRTogc2NvcmVzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBsZWFkZXJib2FyZENhY2hlVGFibGUuZ3JhbnRSZWFkRGF0YShsZWFkZXJib2FyZEFwaUxhbWJkYSk7XG4gICAgc2NvcmVzVGFibGUuZ3JhbnRSZWFkRGF0YShsZWFkZXJib2FyZEFwaUxhbWJkYSk7XG5cbiAgICAvLyBDYXRlZ29yaWVzIHNlcnZpY2VcbiAgICBjb25zdCBjYXRlZ29yaWVzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ2F0ZWdvcmllc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY2F0ZWdvcmllcycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdDYXRlZ29yaWVzIHNlcnZpY2UgLSB2NSB3aXRoIFJCQUMgYXV0aG9yaXphdGlvbicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIENBVEVHT1JJRVNfVEFCTEU6IGNhdGVnb3JpZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9FVkVOVFNfVEFCTEU6IG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX01FTUJFUlNfVEFCTEU6IG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNhdGVnb3JpZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY2F0ZWdvcmllc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uRXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShjYXRlZ29yaWVzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShjYXRlZ29yaWVzTGFtYmRhKTtcblxuICAgIC8vIFdPRHMgc2VydmljZVxuICAgIGNvbnN0IHdvZHNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdXb2RzTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS93b2RzJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ1dPRHMgc2VydmljZSAtIERERCBjb21wbGlhbnQgLSB2NSB3aXRoIFJCQUMgYXV0aG9yaXphdGlvbicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFdPRFNfVEFCTEU6IHdvZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9FVkVOVFNfVEFCTEU6IG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX01FTUJFUlNfVEFCTEU6IG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFNDT1JFU19UQUJMRTogc2NvcmVzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHdvZHNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEod29kc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLmdyYW50UmVhZERhdGEod29kc0xhbWJkYSk7XG4gICAgc2NvcmVzVGFibGUuZ3JhbnRSZWFkRGF0YSh3b2RzTGFtYmRhKTtcblxuICAgIC8vIFVzZXJzIHNlcnZpY2VcbiAgICBjb25zdCB1c2Vyc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VzZXJzTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hdGhsZXRlcycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMTAsICAvLyBQcmV2ZW50IHJ1bmF3YXkgY29zdHNcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXRobGV0ZXMgc2VydmljZSAtIHYzIHdpdGggUkJBQyBhdXRob3JpemF0aW9uJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgQVRITEVURVNfVEFCTEU6IGF0aGxldGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBVEhMRVRFX0VWRU5UU19UQUJMRTogYXRobGV0ZUV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX01FTUJFUlNfVEFCTEU6IG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGF0aGxldGVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVzZXJzTGFtYmRhKTtcbiAgICBhdGhsZXRlRXZlbnRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVzZXJzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkRGF0YSh1c2Vyc0xhbWJkYSk7XG5cbiAgICAvLyBBbmFseXRpY3Mgc2VydmljZVxuICAgIGNvbnN0IGFuYWx5dGljc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FuYWx5dGljc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2FuYWx5dGljcy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3NoYXJlZCcpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogNSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW5hbHl0aWNzIHNlcnZpY2Ugd2l0aCBvcmdhbml6YXRpb24gZmlsdGVyaW5nIC0gdjEnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBFVkVOVFNfVEFCTEU6IGV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVRITEVURVNfVEFCTEU6IGF0aGxldGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBVEhMRVRFX0VWRU5UU19UQUJMRTogYXRobGV0ZUV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQ0FURUdPUklFU19UQUJMRTogY2F0ZWdvcmllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgV09EU19UQUJMRTogd29kc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgU0NPUkVTX1RBQkxFOiBzY29yZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9FVkVOVFNfVEFCTEU6IG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX01FTUJFUlNfVEFCTEU6IG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcbiAgICBhdGhsZXRlRXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuICAgIGNhdGVnb3JpZXNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG4gICAgd29kc1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcbiAgICBzY29yZXNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uRXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG5cbiAgICAvLyBTZXNzaW9ucyBzZXJ2aWNlXG4gICAgY29uc3Qgc2Vzc2lvbnNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTZXNzaW9uc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3Nlc3Npb25zLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvc2NoZWR1bGluZycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMTAsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNFU1NJT05TX1RBQkxFOiBzZXNzaW9uc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2Vzc2lvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc2Vzc2lvbnNMYW1iZGEpO1xuXG4gICAgLy8gU3RlcCBGdW5jdGlvbnMgVGFzayBMYW1iZGEgRnVuY3Rpb25zXG4gICAgY29uc3QgZ2V0RXZlbnREYXRhTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0RXZlbnREYXRhTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0LWV2ZW50LWRhdGEuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9zaGFyZWQnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgRVZFTlRTX1RBQkxFOiBldmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVWRU5UX0RBWVNfVEFCTEU6IGV2ZW50RGF5c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRBdGhsZXRlc0RhdGFMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRBdGhsZXRlc0RhdGFMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdnZXQtYXRobGV0ZXMtZGF0YS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2F0aGxldGVzJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEFUSExFVEVTX1RBQkxFOiBhdGhsZXRlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVRITEVURV9FVkVOVFNfVEFCTEU6IGF0aGxldGVFdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0Q2F0ZWdvcmllc0RhdGFMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRDYXRlZ29yaWVzRGF0YUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2dldC1jYXRlZ29yaWVzLWRhdGEuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jYXRlZ29yaWVzJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIENBVEVHT1JJRVNfVEFCTEU6IGNhdGVnb3JpZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0V29kc0RhdGFMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRXb2RzRGF0YUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2dldC13b2RzLWRhdGEuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS93b2RzJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFdPRFNfVEFCTEU6IHdvZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2VuZXJhdGVTY2hlZHVsZUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dlbmVyYXRlU2NoZWR1bGVMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdnZW5lcmF0ZS1zY2hlZHVsZS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NvbXBldGl0aW9ucycpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNDSEVEVUxFU19UQUJMRTogc2NoZWR1bGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zXG4gICAgZXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRFdmVudERhdGFMYW1iZGEpO1xuICAgIGV2ZW50RGF5c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0RXZlbnREYXRhTGFtYmRhKTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0QXRobGV0ZXNEYXRhTGFtYmRhKTtcbiAgICBhdGhsZXRlRXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRBdGhsZXRlc0RhdGFMYW1iZGEpO1xuICAgIGNhdGVnb3JpZXNUYWJsZS5ncmFudFJlYWREYXRhKGdldENhdGVnb3JpZXNEYXRhTGFtYmRhKTtcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRXb2RzRGF0YUxhbWJkYSk7XG4gICAgc2NoZWR1bGVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdlbmVyYXRlU2NoZWR1bGVMYW1iZGEpO1xuXG4gICAgLy8gU3RlcCBGdW5jdGlvbnMgRXhwcmVzcyBXb3JrZmxvd1xuICAgIGNvbnN0IGdldEV2ZW50RGF0YVRhc2sgPSBuZXcgc3RlcGZ1bmN0aW9uc1Rhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnR2V0RXZlbnREYXRhVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZXRFdmVudERhdGFMYW1iZGEsXG4gICAgICByZXN1bHRQYXRoOiAnJC5ldmVudFJlc3VsdCdcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldEF0aGxldGVzRGF0YVRhc2sgPSBuZXcgc3RlcGZ1bmN0aW9uc1Rhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnR2V0QXRobGV0ZXNEYXRhVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZXRBdGhsZXRlc0RhdGFMYW1iZGEsXG4gICAgICByZXN1bHRQYXRoOiAnJC5hdGhsZXRlc1Jlc3VsdCdcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldENhdGVnb3JpZXNEYXRhVGFzayA9IG5ldyBzdGVwZnVuY3Rpb25zVGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdHZXRDYXRlZ29yaWVzRGF0YVRhc2snLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogZ2V0Q2F0ZWdvcmllc0RhdGFMYW1iZGEsXG4gICAgICByZXN1bHRQYXRoOiAnJC5jYXRlZ29yaWVzUmVzdWx0J1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0V29kc0RhdGFUYXNrID0gbmV3IHN0ZXBmdW5jdGlvbnNUYXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0dldFdvZHNEYXRhVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZXRXb2RzRGF0YUxhbWJkYSxcbiAgICAgIHJlc3VsdFBhdGg6ICckLndvZHNSZXN1bHQnXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZW5lcmF0ZVNjaGVkdWxlVGFzayA9IG5ldyBzdGVwZnVuY3Rpb25zVGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdHZW5lcmF0ZVNjaGVkdWxlVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZW5lcmF0ZVNjaGVkdWxlTGFtYmRhLFxuICAgICAgcGF5bG9hZDogc3RlcGZ1bmN0aW9ucy5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICdldmVudElkLiQnOiAnJFswXS5ldmVudElkJyxcbiAgICAgICAgJ2NvbmZpZy4kJzogJyRbMF0uY29uZmlnJyxcbiAgICAgICAgJ2V2ZW50RGF0YS4kJzogJyRbMF0uZXZlbnRSZXN1bHQuUGF5bG9hZC5ldmVudERhdGEnLFxuICAgICAgICAnZGF5cy4kJzogJyRbMF0uZXZlbnRSZXN1bHQuUGF5bG9hZC5kYXlzJyxcbiAgICAgICAgJ2F0aGxldGVzLiQnOiAnJFsxXS5hdGhsZXRlc1Jlc3VsdC5QYXlsb2FkLmF0aGxldGVzJyxcbiAgICAgICAgJ2NhdGVnb3JpZXMuJCc6ICckWzJdLmNhdGVnb3JpZXNSZXN1bHQuUGF5bG9hZC5jYXRlZ29yaWVzJyxcbiAgICAgICAgJ3dvZHMuJCc6ICckWzNdLndvZHNSZXN1bHQuUGF5bG9hZC53b2RzJ1xuICAgICAgfSksXG4gICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJ1xuICAgIH0pO1xuXG4gICAgLy8gUGFyYWxsZWwgZGF0YSBjb2xsZWN0aW9uXG4gICAgY29uc3QgcGFyYWxsZWxEYXRhQ29sbGVjdGlvbiA9IG5ldyBzdGVwZnVuY3Rpb25zLlBhcmFsbGVsKHRoaXMsICdQYXJhbGxlbERhdGFDb2xsZWN0aW9uJylcbiAgICAgIC5icmFuY2goZ2V0RXZlbnREYXRhVGFzaylcbiAgICAgIC5icmFuY2goZ2V0QXRobGV0ZXNEYXRhVGFzaylcbiAgICAgIC5icmFuY2goZ2V0Q2F0ZWdvcmllc0RhdGFUYXNrKVxuICAgICAgLmJyYW5jaChnZXRXb2RzRGF0YVRhc2spO1xuXG4gICAgY29uc3Qgc2NoZWR1bGVyV29ya2Zsb3cgPSBwYXJhbGxlbERhdGFDb2xsZWN0aW9uLm5leHQoZ2VuZXJhdGVTY2hlZHVsZVRhc2spO1xuXG4gICAgLy8gRXhwcmVzcyBTdGF0ZSBNYWNoaW5lXG4gICAgY29uc3Qgc2NoZWR1bGVyU3RhdGVNYWNoaW5lID0gbmV3IHN0ZXBmdW5jdGlvbnMuU3RhdGVNYWNoaW5lKHRoaXMsICdTY2hlZHVsZXJTdGF0ZU1hY2hpbmUnLCB7XG4gICAgICBkZWZpbml0aW9uQm9keTogc3RlcGZ1bmN0aW9ucy5EZWZpbml0aW9uQm9keS5mcm9tQ2hhaW5hYmxlKHNjaGVkdWxlcldvcmtmbG93KSxcbiAgICAgIHN0YXRlTWFjaGluZVR5cGU6IHN0ZXBmdW5jdGlvbnMuU3RhdGVNYWNoaW5lVHlwZS5FWFBSRVNTLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMilcbiAgICB9KTtcblxuICAgIC8vIERERC1Db21wbGlhbnQgU2NoZWR1bGVyIExhbWJkYVxuICAgIGNvbnN0IHNjaGVkdWxlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1NjaGVkdWxlckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3NjaGVkdWxlci1zdGVwZnVuY3Rpb25zLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY29tcGV0aXRpb25zJyksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0RERC1jb21wbGlhbnQgQ29tcGV0aXRpb24gU2NoZWR1bGVyIFNlcnZpY2UgLSB2OC4wJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgU0NIRURVTEVTX1RBQkxFOiBzY2hlZHVsZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFNDSEVEVUxFUl9TVEFURV9NQUNISU5FX0FSTjogc2NoZWR1bGVyU3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybixcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gb3duZWQgdGFibGUgKFNjaGVkdWxlIGJvdW5kZWQgY29udGV4dClcbiAgICBzY2hlZHVsZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc2NoZWR1bGVyTGFtYmRhKTtcbiAgICBcbiAgICAvLyBHcmFudCBTdGVwIEZ1bmN0aW9ucyBleGVjdXRpb24gcGVybWlzc2lvblxuICAgIHNjaGVkdWxlclN0YXRlTWFjaGluZS5ncmFudFN0YXJ0U3luY0V4ZWN1dGlvbihzY2hlZHVsZXJMYW1iZGEpO1xuICAgIFxuICAgIC8vIEdyYW50IEV2ZW50QnJpZGdlIHBlcm1pc3Npb25zIGZvciBkb21haW4gZXZlbnRzXG4gICAgc2NoZWR1bGVyTGFtYmRhLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmV2ZW50czoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZXZlbnQtYnVzL2RlZmF1bHRgXVxuICAgIH0pKTtcblxuICAgIC8vIERERCBTY2hlZHVsZXIgTGFtYmRhIChzZXBhcmF0ZSBmcm9tIFN0ZXAgRnVuY3Rpb25zIHNjaGVkdWxlcilcbiAgICBjb25zdCBkZGRTY2hlZHVsZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdERERTY2hlZHVsZXJMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdkZGQtaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3NjaGVkdWxpbmcnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnREREIFNjaGVkdWxlciAtIHYyIHdpdGggUkJBQyBhdXRob3JpemF0aW9uJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgU0NIRURVTEVTX1RBQkxFOiBzY2hlZHVsZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEhFQVRTX1RBQkxFOiBoZWF0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQ0xBU1NJRklDQVRJT05fRklMVEVSU19UQUJMRTogY2xhc3NpZmljYXRpb25GaWx0ZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyBmb3IgREREIHNjaGVkdWxlclxuICAgIHNjaGVkdWxlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkZGRTY2hlZHVsZXJMYW1iZGEpO1xuICAgIGhlYXRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRkZFNjaGVkdWxlckxhbWJkYSk7XG4gICAgY2xhc3NpZmljYXRpb25GaWx0ZXJzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRkZFNjaGVkdWxlckxhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uRXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShkZGRTY2hlZHVsZXJMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS5ncmFudFJlYWREYXRhKGRkZFNjaGVkdWxlckxhbWJkYSk7XG5cbiAgICAvLyBQdWJsaWMgU2NoZWR1bGVzIExhbWJkYSBmb3IgYXRobGV0ZSBhY2Nlc3MgKHVzZXMgREREIHNjaGVkdWxlciBmb3IgcHVibGlzaGVkIHNjaGVkdWxlcylcbiAgICBjb25zdCBwdWJsaWNTY2hlZHVsZXNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQdWJsaWNTY2hlZHVsZXNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdwdWJsaWMtc2NoZWR1bGVzLWRkZC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NvbXBldGl0aW9ucycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaWMgc2NoZWR1bGVzIHNlcnZpY2UgZm9yIGF0aGxldGUgYWNjZXNzIC0gREREIHYyLjAnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBTQ0hFRFVMRVNfVEFCTEU6IHNjaGVkdWxlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgc2NoZWR1bGVzVGFibGUuZ3JhbnRSZWFkRGF0YShwdWJsaWNTY2hlZHVsZXNMYW1iZGEpO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2UgaGFuZGxlcnMgZm9yIGFsbCBkb21haW5zXG4gICAgY29uc3QgZXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZXZlbnRzLWV2ZW50YnJpZGdlLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jb21wZXRpdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRXZlbnRzIGRvbWFpbiBFdmVudEJyaWRnZSBoYW5kbGVyIC0gdjInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBFVkVOVFNfVEFCTEU6IGV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRVZFTlRfREFZU19UQUJMRTogZXZlbnREYXlzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9CVVNfTkFNRTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICBldmVudHNUYWJsZS5ncmFudFJlYWREYXRhKGV2ZW50c0V2ZW50QnJpZGdlSGFuZGxlcik7XG4gICAgZXZlbnREYXlzVGFibGUuZ3JhbnRSZWFkRGF0YShldmVudHNFdmVudEJyaWRnZUhhbmRsZXIpO1xuICAgIGV2ZW50c0V2ZW50QnJpZGdlSGFuZGxlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgY29uc3QgYXRobGV0ZXNFdmVudEJyaWRnZUhhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBdGhsZXRlc0V2ZW50QnJpZGdlSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2F0aGxldGVzLWV2ZW50YnJpZGdlLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jb21wZXRpdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXRobGV0ZXMgZG9tYWluIEV2ZW50QnJpZGdlIGhhbmRsZXIgLSB2MScsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEFUSExFVEVTX1RBQkxFOiBhdGhsZXRlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVRITEVURV9FVkVOVFNfVEFCTEU6IGF0aGxldGVFdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVWRU5UX0JVU19OQU1FOiAnZGVmYXVsdCcsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIGF0aGxldGVzVGFibGUuZ3JhbnRSZWFkRGF0YShhdGhsZXRlc0V2ZW50QnJpZGdlSGFuZGxlcik7XG4gICAgYXRobGV0ZUV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoYXRobGV0ZXNFdmVudEJyaWRnZUhhbmRsZXIpO1xuICAgIGF0aGxldGVzRXZlbnRCcmlkZ2VIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICBjb25zdCBjYXRlZ29yaWVzRXZlbnRCcmlkZ2VIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ2F0ZWdvcmllc0V2ZW50QnJpZGdlSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2NhdGVnb3JpZXMtZXZlbnRicmlkZ2UtaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NvbXBldGl0aW9ucycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdDYXRlZ29yaWVzIGRvbWFpbiBFdmVudEJyaWRnZSBoYW5kbGVyIC0gdjEnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBDQVRFR09SSUVTX1RBQkxFOiBjYXRlZ29yaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9CVVNfTkFNRTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICBjYXRlZ29yaWVzVGFibGUuZ3JhbnRSZWFkRGF0YShjYXRlZ29yaWVzRXZlbnRCcmlkZ2VIYW5kbGVyKTtcbiAgICBjYXRlZ29yaWVzRXZlbnRCcmlkZ2VIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICBjb25zdCB3b2RzRXZlbnRCcmlkZ2VIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnV29kc0V2ZW50QnJpZGdlSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3dvZHMtZXZlbnRicmlkZ2UtaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NvbXBldGl0aW9ucycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdXT0RzIGRvbWFpbiBFdmVudEJyaWRnZSBoYW5kbGVyIC0gdjEnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBXT0RTX1RBQkxFOiB3b2RzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9CVVNfTkFNRTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkRGF0YSh3b2RzRXZlbnRCcmlkZ2VIYW5kbGVyKTtcbiAgICB3b2RzRXZlbnRCcmlkZ2VIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICAvLyBFdmVudEJyaWRnZSBydWxlcyBmb3IgZG9tYWluIGV2ZW50IGhhbmRsZXJzXG4gICAgY29uc3QgZXZlbnRCdXMgPSBldmVudGJyaWRnZS5FdmVudEJ1cy5mcm9tRXZlbnRCdXNOYW1lKHRoaXMsICdEZWZhdWx0RXZlbnRCdXMnLCAnZGVmYXVsdCcpO1xuICAgIFxuICAgIC8vIFJ1bGVzIGZvciBkYXRhIHJlcXVlc3RzIGZyb20gc2NoZWR1bGVyIG9yY2hlc3RyYXRvclxuICAgIG5ldyBldmVudGJyaWRnZS5SdWxlKHRoaXMsICdFdmVudERhdGFSZXF1ZXN0UnVsZScsIHtcbiAgICAgIGV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydzY2hlZHVsZXIub3JjaGVzdHJhdG9yJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnRXZlbnQgRGF0YSBSZXF1ZXN0ZWQnXVxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihldmVudHNFdmVudEJyaWRnZUhhbmRsZXIpXVxuICAgIH0pO1xuXG4gICAgbmV3IGV2ZW50YnJpZGdlLlJ1bGUodGhpcywgJ0F0aGxldGVzRGF0YVJlcXVlc3RSdWxlJywge1xuICAgICAgZXZlbnRCdXMsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ3NjaGVkdWxlci5vcmNoZXN0cmF0b3InXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydBdGhsZXRlcyBEYXRhIFJlcXVlc3RlZCddXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGF0aGxldGVzRXZlbnRCcmlkZ2VIYW5kbGVyKV1cbiAgICB9KTtcblxuICAgIG5ldyBldmVudGJyaWRnZS5SdWxlKHRoaXMsICdDYXRlZ29yaWVzRGF0YVJlcXVlc3RSdWxlJywge1xuICAgICAgZXZlbnRCdXMsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ3NjaGVkdWxlci5vcmNoZXN0cmF0b3InXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydDYXRlZ29yaWVzIERhdGEgUmVxdWVzdGVkJ11cbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oY2F0ZWdvcmllc0V2ZW50QnJpZGdlSGFuZGxlcildXG4gICAgfSk7XG5cbiAgICBuZXcgZXZlbnRicmlkZ2UuUnVsZSh0aGlzLCAnV29kc0RhdGFSZXF1ZXN0UnVsZScsIHtcbiAgICAgIGV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydzY2hlZHVsZXIub3JjaGVzdHJhdG9yJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnV09EcyBEYXRhIFJlcXVlc3RlZCddXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHdvZHNFdmVudEJyaWRnZUhhbmRsZXIpXVxuICAgIH0pO1xuXG4gICAgLy8gUnVsZXMgZm9yIGRvbWFpbiByZXNwb25zZXMgYmFjayB0byBzY2hlZHVsZXIgb3JjaGVzdHJhdG9yXG4gICAgbmV3IGV2ZW50YnJpZGdlLlJ1bGUodGhpcywgJ0RvbWFpblJlc3BvbnNlc1J1bGUnLCB7XG4gICAgICBldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnZXZlbnRzLmRvbWFpbicsICdhdGhsZXRlcy5kb21haW4nLCAnY2F0ZWdvcmllcy5kb21haW4nLCAnd29kcy5kb21haW4nXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydFdmVudCBEYXRhIFJlc3BvbnNlJywgJ0F0aGxldGVzIERhdGEgUmVzcG9uc2UnLCAnQ2F0ZWdvcmllcyBEYXRhIFJlc3BvbnNlJywgJ1dPRHMgRGF0YSBSZXNwb25zZSddXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHNjaGVkdWxlckxhbWJkYSldXG4gICAgfSk7XG5cbiAgICAvLyBFdmVudEJyaWRnZSBmb3IgZGVjb3VwbGVkIGxlYWRlcmJvYXJkIGNhbGN1bGF0aW9uc1xuICAgIGNvbnN0IGxlYWRlcmJvYXJkQ2FsY3VsYXRvciA9IG5ldyBFdmVudGJyaWRnZVRvTGFtYmRhKHRoaXMsICdMZWFkZXJib2FyZENhbGN1bGF0b3InLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvblByb3BzOiB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgICBoYW5kbGVyOiAnbGVhZGVyYm9hcmQtY2FsY3VsYXRvci1lbmhhbmNlZC5oYW5kbGVyJyxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY29tcGV0aXRpb25zJyksXG4gICAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgU0NPUkVTX1RBQkxFOiBzY29yZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgICAgTEVBREVSQk9BUkRfVEFCTEU6IGxlYWRlcmJvYXJkQ2FjaGVUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZXZlbnRSdWxlUHJvcHM6IHtcbiAgICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgICAgc291cmNlOiBbJ3Njb3JpbmdhbWVzLnNjb3JlcyddLFxuICAgICAgICAgIGRldGFpbFR5cGU6IFsnU2NvcmVDYWxjdWxhdGVkJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNjb3Jlc1RhYmxlLmdyYW50UmVhZERhdGEobGVhZGVyYm9hcmRDYWxjdWxhdG9yLmxhbWJkYUZ1bmN0aW9uKTtcbiAgICBsZWFkZXJib2FyZENhY2hlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxlYWRlcmJvYXJkQ2FsY3VsYXRvci5sYW1iZGFGdW5jdGlvbik7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSB3aXRoIG1pY3Jvc2VydmljZXMgcm91dGluZ1xuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0NhbGlzdGhlbmljc0FwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnQ2FsaXN0aGVuaWNzIENvbXBldGl0aW9uIEFQSScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHRocm90dGxpbmdCdXJzdExpbWl0OiAxMDAsICAvLyBNYXggY29uY3VycmVudCByZXF1ZXN0c1xuICAgICAgICB0aHJvdHRsaW5nUmF0ZUxpbWl0OiA1MCwgICAgLy8gUmVxdWVzdHMgcGVyIHNlY29uZFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvZ25pdG9BdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgJ0NvZ25pdG9BdXRob3JpemVyJywge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbiAgICB9KTtcblxuICAgIC8vIFB1YmxpYyBlbmRwb2ludCBmb3IgcHVibGlzaGVkIGV2ZW50cyAtIC9wdWJsaWMvZXZlbnRzIChubyBhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IHB1YmxpY1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3B1YmxpYycpO1xuICAgIGNvbnN0IHB1YmxpY0V2ZW50cyA9IHB1YmxpY1Jlc291cmNlLmFkZFJlc291cmNlKCdldmVudHMnKTtcbiAgICBwdWJsaWNFdmVudHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjb21wZXRpdGlvbnNMYW1iZGEpKTtcbiAgICBjb25zdCBwdWJsaWNFdmVudHNQcm94eSA9IHB1YmxpY0V2ZW50cy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBwdWJsaWNFdmVudHNQcm94eS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNvbXBldGl0aW9uc0xhbWJkYSkpO1xuXG4gICAgLy8gUHVibGljIGVuZHBvaW50IGZvciBwdWJsaXNoZWQgc2NoZWR1bGVzIC0gL3B1YmxpYy9zY2hlZHVsZXMgKG5vIGF1dGggcmVxdWlyZWQpXG4gICAgY29uc3QgcHVibGljU2NoZWR1bGVzID0gcHVibGljUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3NjaGVkdWxlcycpO1xuICAgIHB1YmxpY1NjaGVkdWxlcy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHB1YmxpY1NjaGVkdWxlc0xhbWJkYSkpO1xuICAgIGNvbnN0IHB1YmxpY1NjaGVkdWxlc1Byb3h5ID0gcHVibGljU2NoZWR1bGVzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHB1YmxpY1NjaGVkdWxlc1Byb3h5LmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHVibGljU2NoZWR1bGVzTGFtYmRhKSk7XG5cbiAgICAvLyBQdWJsaWMgZW5kcG9pbnQgZm9yIHNjb3JlcyAtIC9wdWJsaWMvc2NvcmVzIChubyBhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IHB1YmxpY1Njb3JlcyA9IHB1YmxpY1Jlc291cmNlLmFkZFJlc291cmNlKCdzY29yZXMnKTtcbiAgICBwdWJsaWNTY29yZXMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzY29yZXNMYW1iZGEpKTtcblxuICAgIC8vIENvbXBldGl0aW9ucyBtaWNyb3NlcnZpY2UgLSAvY29tcGV0aXRpb25zLyogKGF1dGggcmVxdWlyZWQpXG4gICAgY29uc3QgY29tcGV0aXRpb25zID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2NvbXBldGl0aW9ucycpO1xuICAgIGNvbXBldGl0aW9ucy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNvbXBldGl0aW9uc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgY29tcGV0aXRpb25zUHJveHkgPSBjb21wZXRpdGlvbnMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgY29tcGV0aXRpb25zUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjb21wZXRpdGlvbnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gT3JnYW5pemF0aW9ucyBtaWNyb3NlcnZpY2UgLSAvb3JnYW5pemF0aW9ucy8qXG4gICAgY29uc3Qgb3JnYW5pemF0aW9ucyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdvcmdhbml6YXRpb25zJyk7XG4gICAgb3JnYW5pemF0aW9ucy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG9yZ2FuaXphdGlvbnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IG9yZ2FuaXphdGlvbnNQcm94eSA9IG9yZ2FuaXphdGlvbnMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgb3JnYW5pemF0aW9uc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3JnYW5pemF0aW9uc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBFdmVudHMgbWljcm9zZXJ2aWNlIC0gL2V2ZW50cy8qXG4gICAgY29uc3QgZXZlbnRzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2V2ZW50cycpO1xuICAgIGV2ZW50cy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGV2ZW50c0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgZXZlbnRzUHJveHkgPSBldmVudHMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgZXZlbnRzUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihldmVudHNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gU2NvcmVzIG1pY3Jvc2VydmljZSAtIC9zY29yZXMvKlxuICAgIGNvbnN0IHNjb3JlcyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzY29yZXMnKTtcbiAgICBzY29yZXMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzY29yZXNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IHNjb3Jlc1Byb3h5ID0gc2NvcmVzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHNjb3Jlc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2NvcmVzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIEV4ZXJjaXNlIExpYnJhcnkgbWljcm9zZXJ2aWNlIC0gL2V4ZXJjaXNlcy8qXG4gICAgY29uc3QgZXhlcmNpc2VzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2V4ZXJjaXNlcycpO1xuICAgIGV4ZXJjaXNlcy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGV4ZXJjaXNlTGlicmFyeUxhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgZXhlcmNpc2VzUHJveHkgPSBleGVyY2lzZXMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgZXhlcmNpc2VzUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihleGVyY2lzZUxpYnJhcnlMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gTGVhZGVyYm9hcmQgQVBJIC0gL2xlYWRlcmJvYXJkIChwdWJsaWMgZW5kcG9pbnQpXG4gICAgY29uc3QgbGVhZGVyYm9hcmQgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnbGVhZGVyYm9hcmQnKTtcbiAgICBsZWFkZXJib2FyZC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxlYWRlcmJvYXJkQXBpTGFtYmRhKSk7XG5cbiAgICAvLyBDYXRlZ29yaWVzIG1pY3Jvc2VydmljZSAtIC9jYXRlZ29yaWVzLypcbiAgICBjb25zdCBjYXRlZ29yaWVzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2NhdGVnb3JpZXMnKTtcbiAgICBjYXRlZ29yaWVzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY2F0ZWdvcmllc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgY2F0ZWdvcmllc1Byb3h5ID0gY2F0ZWdvcmllcy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBjYXRlZ29yaWVzUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjYXRlZ29yaWVzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIFdPRHMgbWljcm9zZXJ2aWNlIC0gL3dvZHMvKlxuICAgIGNvbnN0IHdvZHMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnd29kcycpO1xuICAgIHdvZHMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih3b2RzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCB3b2RzUHJveHkgPSB3b2RzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHdvZHNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHdvZHNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gVXNlcnMgbWljcm9zZXJ2aWNlIC0gL21lLyogYW5kIC91c2Vycy8qIGFuZCAvYXRobGV0ZXMvKlxuICAgIGNvbnN0IG1lID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ21lJyk7XG4gICAgbWUuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgbWVQcm94eSA9IG1lLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIG1lUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCB1c2VycyA9IGFwaS5yb290LmFkZFJlc291cmNlKCd1c2VycycpO1xuICAgIHVzZXJzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IHVzZXJzUHJveHkgPSB1c2Vycy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICB1c2Vyc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gTGVnYWN5IC9hdGhsZXRlcyByb3V0ZSAobWFwcyB0byB1c2VycyBMYW1iZGEpXG4gICAgY29uc3QgYXRobGV0ZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYXRobGV0ZXMnKTtcbiAgICBhdGhsZXRlcy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBhdGhsZXRlc1Byb3h5ID0gYXRobGV0ZXMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgYXRobGV0ZXNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIFNlc3Npb25zIG1pY3Jvc2VydmljZSAtIC9zZXNzaW9ucy8qXG4gICAgY29uc3Qgc2Vzc2lvbnMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnc2Vzc2lvbnMnKTtcbiAgICBzZXNzaW9ucy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBzZXNzaW9uc1Byb3h5ID0gc2Vzc2lvbnMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgc2Vzc2lvbnNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIFNjaGVkdWxlciBtaWNyb3NlcnZpY2UgLSAvc2NoZWR1bGVyLyogKERERCBzY2hlZHVsZXIgd2l0aCBSQkFDKVxuICAgIGNvbnN0IHNjaGVkdWxlciA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzY2hlZHVsZXInKTtcbiAgICBzY2hlZHVsZXIuYWRkTWV0aG9kKCdPUFRJT05TJywgbmV3IGFwaWdhdGV3YXkuTW9ja0ludGVncmF0aW9uKHtcbiAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbe1xuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ1wiLFxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXCIsXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIlxuICAgICAgICB9XG4gICAgICB9XSxcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAne1wic3RhdHVzQ29kZVwiOiAyMDB9J1xuICAgICAgfVxuICAgIH0pLCB7XG4gICAgICBtZXRob2RSZXNwb25zZXM6IFt7XG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZSxcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfSk7XG4gICAgc2NoZWR1bGVyLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGRkU2NoZWR1bGVyTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBzY2hlZHVsZXJQcm94eSA9IHNjaGVkdWxlci5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBzY2hlZHVsZXJQcm94eS5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ2F0ZXdheS5Nb2NrSW50ZWdyYXRpb24oe1xuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nXCIsXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcIixcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgIH1cbiAgICAgIH1dLFxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XCJzdGF0dXNDb2RlXCI6IDIwMH0nXG4gICAgICB9XG4gICAgfSksIHtcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9KTtcbiAgICBzY2hlZHVsZXJQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGRkZFNjaGVkdWxlckxhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBBbmFseXRpY3MgbWljcm9zZXJ2aWNlIC0gL2FuYWx5dGljcy8qXG4gICAgY29uc3QgYW5hbHl0aWNzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FuYWx5dGljcycpO1xuICAgIGFuYWx5dGljcy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFuYWx5dGljc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7IHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywgeyB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywgeyB2YWx1ZTogYXBpLnVybCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2Vic2l0ZVVybCcsIHsgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFdmVudEltYWdlc0J1Y2tldE5hbWUnLCB7IHZhbHVlOiBldmVudEltYWdlc0J1Y2tldC5idWNrZXROYW1lIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZEJ1Y2tldE5hbWUnLCB7IHZhbHVlOiB3ZWJzaXRlQnVja2V0LmJ1Y2tldE5hbWUgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rpc3RyaWJ1dGlvbklkJywgeyB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkIH0pO1xuICAgIFxuICAgIC8vIERERCBTY2hlZHVsZXIgb3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdERERTY2hlZHVsZXJMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogc2NoZWR1bGVyTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdEREQtY29tcGxpYW50IFNjaGVkdWxlciBMYW1iZGEgQVJOJ1xuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTY2hlZHVsZXJFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiBgJHthcGkudXJsfXNjaGVkdWxlci9gLFxuICAgICAgZGVzY3JpcHRpb246ICdEREQgU2NoZWR1bGVyIEFQSSBlbmRwb2ludCdcbiAgICB9KTtcbiAgICBcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRDb25maWcnLCB7XG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBhcGlVcmw6IGFwaS51cmwsXG4gICAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIHVzZXJQb29sQ2xpZW50SWQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICB9KSxcbiAgICB9KTtcbiAgfVxufVxuIl19