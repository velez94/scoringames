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
            description: 'WODs service - v6.2 with organization-only editing restrictions',
            environment: {
                ...commonEnv,
                WODS_TABLE: wodsTable.tableName,
                ORGANIZATIONS_TABLE: organizationsTable.tableName,
                ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
                ORGANIZATION_MEMBERS_TABLE: organizationMembersTable.tableName,
                SCORES_TABLE: scoresTable.tableName,
            },
        });
        wodsTable.grantReadWriteData(wodsLambda);
        organizationsTable.grantReadData(wodsLambda);
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
        const publicResource = api.root.addResource('public', {
            defaultCorsPreflightOptions: {
                allowOrigins: ['*'],
                allowMethods: ['GET', 'POST', 'OPTIONS'],
                allowHeaders: ['Content-Type', 'Authorization'],
            }
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsaXN0aGVuaWNzLWFwcC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNhbGlzdGhlbmljcy1hcHAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLG1EQUFtRDtBQUNuRCxxREFBcUQ7QUFDckQsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCx5Q0FBeUM7QUFDekMseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCxzREFBc0Q7QUFDdEQsMERBQTBEO0FBQzFELDJDQUEyQztBQUUzQywrREFBK0Q7QUFDL0QsMEVBQTBFO0FBQzFFLDZGQUF1RjtBQUd2RixNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsdUNBQXVDO1FBQ3ZDLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDbEUsWUFBWSxFQUFFLG9CQUFvQjtZQUNsQyxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDOUIsa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtnQkFDeEMsU0FBUyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2dCQUM1QyxVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDOUM7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDaEIsSUFBSSxFQUFFLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUs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LEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLFlBQVk7WUFDN0IsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUc7Z0JBQ2YsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO2dCQUMvQixnQkFBZ0IsRUFBRSxjQUFjLENBQUMsZ0JBQWdCO2dCQUNqRCxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07YUFDcEIsQ0FBQztTQUNILENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTFrQ0Qsb0RBMGtDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBldmVudGJyaWRnZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc3RlcGZ1bmN0aW9uc1Rhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCB7IEV2ZW50YnJpZGdlVG9MYW1iZGEgfSBmcm9tICdAYXdzLXNvbHV0aW9ucy1jb25zdHJ1Y3RzL2F3cy1ldmVudGJyaWRnZS1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBDYWxpc3RoZW5pY3NBcHBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sIGZvciBhdXRoZW50aWNhdGlvblxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0NhbGlzdGhlbmljc1VzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiAnY2FsaXN0aGVuaWNzLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH0sXG4gICAgICAgIGdpdmVuTmFtZTogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH0sXG4gICAgICB9LFxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICByb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtaW5MZW46IDEsIG1heExlbjogMjAsIG11dGFibGU6IHRydWUgfSksIC8vIExlZ2FjeSAtIGtlcHQgZm9yIGNvbXBhdGliaWxpdHlcbiAgICAgICAgZGl2aXNpb246IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG1pbkxlbjogMSwgbWF4TGVuOiA1MCwgbXV0YWJsZTogdHJ1ZSB9KSwgLy8gTGVnYWN5IC0ga2VwdCBmb3IgY29tcGF0aWJpbGl0eVxuICAgICAgICBpc1N1cGVyQWRtaW46IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG1pbkxlbjogMSwgbWF4TGVuOiA1LCBtdXRhYmxlOiB0cnVlIH0pLCAvLyAndHJ1ZScgb3IgJ2ZhbHNlJ1xuICAgICAgICBvcmdhbml6ZXJSb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtaW5MZW46IDEsIG1heExlbjogMjAsIG11dGFibGU6IHRydWUgfSksIC8vICdzdXBlcl9hZG1pbicsICdldmVudF9hZG1pbicsICdhdXhpbGlhcnlfYWRtaW4nXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ0NhbGlzdGhlbmljc1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2wsXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RCIFRhYmxlcyAtIE11bHRpLXRlbmFudCBhcmNoaXRlY3R1cmUgd2l0aCBldmVudCBpc29sYXRpb25cbiAgICAvLyBVc2luZyBPbi1EZW1hbmQgYmlsbGluZyBmb3IgY29zdCBvcHRpbWl6YXRpb24gYW5kIHVucHJlZGljdGFibGUgdHJhZmZpYyBwYXR0ZXJuc1xuICAgIFxuICAgIC8vIEV2ZW50cyB0YWJsZSAtIE1haW4gZXZlbnRzIChlLmcuLCBcIlN1bW1lciBHYW1lcyAyMDI1XCIpXG4gICAgY29uc3QgZXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0V2ZW50c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIGV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3N0YXR1cy1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N0YXR1cycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzdGFydERhdGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gT3JnYW5pemF0aW9ucyB0YWJsZVxuICAgIGNvbnN0IG9yZ2FuaXphdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnT3JnYW5pemF0aW9uc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdvcmdhbml6YXRpb25JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIE9yZ2FuaXphdGlvbiBNZW1iZXJzIChtYW55LXRvLW1hbnk6IHVzZXJzIHRvIG9yZ2FuaXphdGlvbnMpXG4gICAgY29uc3Qgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdPcmdhbml6YXRpb25NZW1iZXJzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yZ2FuaXphdGlvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAndXNlci1vcmdhbml6YXRpb25zLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ29yZ2FuaXphdGlvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIE9yZ2FuaXphdGlvbi1FdmVudCBtYXBwaW5nIChldmVudHMgYmVsb25nIHRvIG9yZ2FuaXphdGlvbnMpXG4gICAgY29uc3Qgb3JnYW5pemF0aW9uRXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ09yZ2FuaXphdGlvbkV2ZW50c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdvcmdhbml6YXRpb25JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2V2ZW50LW9yZ2FuaXphdGlvbi1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gTGVnYWN5OiBLZWVwIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGR1cmluZyBtaWdyYXRpb25cbiAgICBjb25zdCBvcmdhbml6ZXJFdmVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnT3JnYW5pemVyRXZlbnRzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIG9yZ2FuaXplckV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2V2ZW50LW9yZ2FuaXplcnMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBdGhsZXRlLUV2ZW50IHJlZ2lzdHJhdGlvbnMgKG1hbnktdG8tbWFueSlcbiAgICBjb25zdCBhdGhsZXRlRXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0F0aGxldGVFdmVudHNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgYXRobGV0ZUV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2V2ZW50LWF0aGxldGVzLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdyZWdpc3RlcmVkQXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQXRobGV0ZXMgdGFibGUgLSBHbG9iYWwgdXNlciBwcm9maWxlc1xuICAgIGNvbnN0IGF0aGxldGVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0F0aGxldGVzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEV2ZW50IERheXMgdGFibGUgLSBJbmRpdmlkdWFsIGRheXMvc2Vzc2lvbnMgd2l0aGluIGFuIGV2ZW50XG4gICAgY29uc3QgZXZlbnREYXlzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0V2ZW50RGF5c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2RheUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ2F0ZWdvcmllcyB0YWJsZSAtIEV2ZW50LXNjb3BlZFxuICAgIGNvbnN0IGNhdGVnb3JpZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ2F0ZWdvcmllc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NhdGVnb3J5SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBXT0RzIHRhYmxlIC0gRXZlbnQtc2NvcGVkXG4gICAgY29uc3Qgd29kc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdXb2RzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnd29kSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBTY29yZXMgdGFibGUgLSBFdmVudC1zY29wZWQgd2l0aCBjb21wb3NpdGUga2V5IGZvciBlZmZpY2llbnQgcXVlcmllc1xuICAgIGNvbnN0IHNjb3Jlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTY29yZXNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzY29yZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSwgLy8gRm9ybWF0OiBkYXlJZCNhdGhsZXRlSWRcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIHNjb3Jlc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2RheS1zY29yZXMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdkYXlJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzY29yZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTY29yaW5nIFN5c3RlbXMgdGFibGUgLSBFdmVudC1zY29wZWQgc2NvcmluZyBjb25maWd1cmF0aW9uc1xuICAgIGNvbnN0IHNjb3JpbmdTeXN0ZW1zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Njb3JpbmdTeXN0ZW1zVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnc2NvcmluZ1N5c3RlbUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gRXhlcmNpc2UgTGlicmFyeSB0YWJsZSAtIEdsb2JhbCBleGVyY2lzZSBkZWZpbml0aW9uc1xuICAgIGNvbnN0IGV4ZXJjaXNlTGlicmFyeVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdFeGVyY2lzZUxpYnJhcnlUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXhlcmNpc2VJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIExlYWRlcmJvYXJkIENhY2hlIHRhYmxlIC0gUHJlLWNhbGN1bGF0ZWQgbGVhZGVyYm9hcmRzXG4gICAgY29uc3QgbGVhZGVyYm9hcmRDYWNoZVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdMZWFkZXJib2FyZENhY2hlVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2xlYWRlcmJvYXJkSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICB9KTtcbiAgICBsZWFkZXJib2FyZENhY2hlVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZXZlbnQtbGVhZGVyYm9hcmRzLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTZXNzaW9ucyB0YWJsZSAtIFVzZXIgc2Vzc2lvbiBtYW5hZ2VtZW50IHdpdGggVFRMXG4gICAgY29uc3Qgc2Vzc2lvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU2Vzc2lvbnNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2Vzc2lvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgc2Vzc2lvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VySWQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIC8vIFNjaGVkdWxlcyB0YWJsZSAtIENvbXBldGl0aW9uIHNjaGVkdWxlc1xuICAgIGNvbnN0IHNjaGVkdWxlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTY2hlZHVsZXNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzY2hlZHVsZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gSGVhdHMgdGFibGUgLSBJbmRpdmlkdWFsIGNvbXBldGl0aW9uIGhlYXRzXG4gICAgY29uc3QgaGVhdHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSGVhdHNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2NoZWR1bGVJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdoZWF0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDbGFzc2lmaWNhdGlvbiBGaWx0ZXJzIHRhYmxlIC0gRWxpbWluYXRpb24gcnVsZXNcbiAgICBjb25zdCBjbGFzc2lmaWNhdGlvbkZpbHRlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ2xhc3NpZmljYXRpb25GaWx0ZXJzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmlsdGVySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBTMyBCdWNrZXQgZm9yIGZyb250ZW5kIGhvc3RpbmdcbiAgICBjb25zdCB3ZWJzaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnV2Vic2l0ZUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBjYWxpc3RoZW5pY3MtYXBwLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gUzMgQnVja2V0IGZvciBldmVudCBpbWFnZXNcbiAgICBjb25zdCBldmVudEltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0V2ZW50SW1hZ2VzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGNhbGlzdGhlbmljcy1ldmVudC1pbWFnZXMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1RdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BQ0xTLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBPcmlnaW4gQWNjZXNzIENvbnRyb2wgKE9BQykgLSBsYXRlc3QgQ0RLIHN5bnRheFxuICAgIGNvbnN0IG9yaWdpbkFjY2Vzc0NvbnRyb2wgPSBuZXcgY2xvdWRmcm9udC5DZm5PcmlnaW5BY2Nlc3NDb250cm9sKHRoaXMsICdPQUMnLCB7XG4gICAgICBvcmlnaW5BY2Nlc3NDb250cm9sQ29uZmlnOiB7XG4gICAgICAgIG5hbWU6ICdjYWxpc3RoZW5pY3MtYXBwLW9hYycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnT0FDIGZvciBDYWxpc3RoZW5pY3MgQXBwJyxcbiAgICAgICAgb3JpZ2luQWNjZXNzQ29udHJvbE9yaWdpblR5cGU6ICdzMycsXG4gICAgICAgIHNpZ25pbmdCZWhhdmlvcjogJ2Fsd2F5cycsXG4gICAgICAgIHNpZ25pbmdQcm90b2NvbDogJ3NpZ3Y0JyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRGlzdHJpYnV0aW9uJywge1xuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbCh3ZWJzaXRlQnVja2V0KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENsb3VkRnJvbnQgYWNjZXNzIHRvIFMzIGJ1Y2tldCB2aWEgYnVja2V0IHBvbGljeVxuICAgIHdlYnNpdGVCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgcmVzb3VyY2VzOiBbd2Vic2l0ZUJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyldLFxuICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY2xvdWRmcm9udC5hbWF6b25hd3MuY29tJyldLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnQVdTOlNvdXJjZUFybic6IGBhcm46YXdzOmNsb3VkZnJvbnQ6OiR7dGhpcy5hY2NvdW50fTpkaXN0cmlidXRpb24vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWR9YCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSkpO1xuXG4gICAgLy8gTWljcm9zZXJ2aWNlczogU2VwYXJhdGUgTGFtYmRhIHBlciBkb21haW5cbiAgICBjb25zdCBjb21tb25FbnYgPSB7XG4gICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgfTtcblxuICAgIC8vIE9yZ2FuaXphdGlvbnMgc2VydmljZVxuICAgIGNvbnN0IG9yZ2FuaXphdGlvbnNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdPcmdhbml6YXRpb25zTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnb3JnYW5pemF0aW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL29yZ2FuaXphdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgT1JHQU5JWkFUSU9OU19UQUJMRTogb3JnYW5pemF0aW9uc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX01FTUJFUlNfVEFCTEU6IG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9FVkVOVFNfVEFCTEU6IG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgb3JnYW5pemF0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShvcmdhbml6YXRpb25zTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG9yZ2FuaXphdGlvbnNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShvcmdhbml6YXRpb25zTGFtYmRhKTtcbiAgICBcbiAgICAvLyBHcmFudCBDb2duaXRvIHBlcm1pc3Npb25zIHRvIGZldGNoIHVzZXIgZGV0YWlsc1xuICAgIG9yZ2FuaXphdGlvbnNMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJ10sXG4gICAgICByZXNvdXJjZXM6IFt1c2VyUG9vbC51c2VyUG9vbEFybl1cbiAgICB9KSk7XG5cbiAgICAvLyBDb21wZXRpdGlvbnMgc2VydmljZSAtIEhhbmRsZXMgY29tcGV0aXRpb25zIGFuZCBwdWJsaWMgZXZlbnRzIGVuZHBvaW50c1xuICAgIGNvbnN0IGNvbXBldGl0aW9uc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NvbXBldGl0aW9uc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY29tcGV0aXRpb25zJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbXBldGl0aW9ucyBzZXJ2aWNlIHdpdGggcHVibGljIGV2ZW50cyBlbmRwb2ludHMgLSB2MicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVWRU5UU19UQUJMRTogZXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9JTUFHRVNfQlVDS0VUOiBldmVudEltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBldmVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY29tcGV0aXRpb25zTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25FdmVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY29tcGV0aXRpb25zTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShjb21wZXRpdGlvbnNMYW1iZGEpOyAvLyBSZWFkLW9ubHkgZm9yIGF1dGhvcml6YXRpb25cbiAgICBldmVudEltYWdlc0J1Y2tldC5ncmFudFB1dChjb21wZXRpdGlvbnNMYW1iZGEpO1xuICAgIFxuICAgIC8vIEdyYW50IEV2ZW50QnJpZGdlIHBlcm1pc3Npb25zIGZvciBldmVudC1kcml2ZW4gY29tbXVuaWNhdGlvblxuICAgIGNvbXBldGl0aW9uc0xhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIEV2ZW50IERheXMgc2VydmljZVxuICAgIGNvbnN0IGV2ZW50c0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0V2ZW50c0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2V2ZW50cy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NvbXBldGl0aW9ucycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBFVkVOVF9EQVlTX1RBQkxFOiBldmVudERheXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVWRU5UX0lNQUdFU19CVUNLRVQ6IGV2ZW50SW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFNDT1JJTkdfU1lTVEVNU19MQU1CREFfTkFNRTogJycsIC8vIFdpbGwgYmUgc2V0IGFmdGVyIHNjb3JpbmdTeXN0ZW1zTGFtYmRhIGlzIGNyZWF0ZWRcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgZXZlbnREYXlzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGV2ZW50c0xhbWJkYSk7XG4gICAgZXZlbnRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZXZlbnRzTGFtYmRhKTtcblxuICAgIC8vIFNjb3JlcyBzZXJ2aWNlXG4gICAgY29uc3Qgc2NvcmVzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2NvcmVzTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9zY29yaW5nJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ1Njb3JlcyBzZXJ2aWNlIC0gdjUgd2l0aCBSQkFDIGF1dGhvcml6YXRpb24nLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBTQ09SRVNfVEFCTEU6IHNjb3Jlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVRITEVURVNfVEFCTEU6IGF0aGxldGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTQ09SSU5HX1NZU1RFTVNfVEFCTEU6IHNjb3JpbmdTeXN0ZW1zVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzY29yZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc2NvcmVzTGFtYmRhKTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZERhdGEoc2NvcmVzTGFtYmRhKTtcbiAgICBzY29yaW5nU3lzdGVtc1RhYmxlLmdyYW50UmVhZERhdGEoc2NvcmVzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25FdmVudHNUYWJsZS5ncmFudFJlYWREYXRhKHNjb3Jlc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLmdyYW50UmVhZERhdGEoc2NvcmVzTGFtYmRhKTtcbiAgICBzY29yZXNMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBTY29yaW5nIFN5c3RlbXMgc2VydmljZVxuICAgIGNvbnN0IHNjb3JpbmdTeXN0ZW1zTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2NvcmluZ1N5c3RlbXNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzeXN0ZW1zLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvc2NvcmluZycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBTQ09SSU5HX1NZU1RFTVNfVEFCTEU6IHNjb3JpbmdTeXN0ZW1zVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzY29yaW5nU3lzdGVtc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzY29yaW5nU3lzdGVtc0xhbWJkYSk7XG4gICAgXG4gICAgLy8gVXBkYXRlIGV2ZW50c0xhbWJkYSBlbnZpcm9ubWVudCB3aXRoIHNjb3JpbmdTeXN0ZW1zTGFtYmRhIG5hbWVcbiAgICBldmVudHNMYW1iZGEuYWRkRW52aXJvbm1lbnQoJ1NDT1JJTkdfU1lTVEVNU19MQU1CREFfTkFNRScsIHNjb3JpbmdTeXN0ZW1zTGFtYmRhLmZ1bmN0aW9uTmFtZSk7XG4gICAgc2NvcmluZ1N5c3RlbXNMYW1iZGEuZ3JhbnRJbnZva2UoZXZlbnRzTGFtYmRhKTtcblxuICAgIC8vIEV4ZXJjaXNlIExpYnJhcnkgc2VydmljZVxuICAgIGNvbnN0IGV4ZXJjaXNlTGlicmFyeUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0V4ZXJjaXNlTGlicmFyeUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2V4ZXJjaXNlLWxpYnJhcnkuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9zY29yaW5nJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVYRVJDSVNFX0xJQlJBUllfVEFCTEU6IGV4ZXJjaXNlTGlicmFyeVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgZXhlcmNpc2VMaWJyYXJ5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGV4ZXJjaXNlTGlicmFyeUxhbWJkYSk7XG5cbiAgICAvLyBTY29yZSBDYWxjdWxhdG9yIHNlcnZpY2UgKHN0YXRlbGVzcyBjYWxjdWxhdGlvbiBlbmdpbmUpXG4gICAgY29uc3Qgc2NvcmVDYWxjdWxhdG9yTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2NvcmVDYWxjdWxhdG9yTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnc2NvcmUtY2FsY3VsYXRvci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3Njb3JpbmcnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMZWFkZXJib2FyZCBBUEkgc2VydmljZVxuICAgIGNvbnN0IGxlYWRlcmJvYXJkQXBpTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGVhZGVyYm9hcmRBcGlMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdsZWFkZXJib2FyZC1hcGkuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9zY29yaW5nJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIExFQURFUkJPQVJEX1RBQkxFOiBsZWFkZXJib2FyZENhY2hlVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTQ09SRVNfVEFCTEU6IHNjb3Jlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgbGVhZGVyYm9hcmRDYWNoZVRhYmxlLmdyYW50UmVhZERhdGEobGVhZGVyYm9hcmRBcGlMYW1iZGEpO1xuICAgIHNjb3Jlc1RhYmxlLmdyYW50UmVhZERhdGEobGVhZGVyYm9hcmRBcGlMYW1iZGEpO1xuXG4gICAgLy8gQ2F0ZWdvcmllcyBzZXJ2aWNlXG4gICAgY29uc3QgY2F0ZWdvcmllc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NhdGVnb3JpZXNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NhdGVnb3JpZXMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2F0ZWdvcmllcyBzZXJ2aWNlIC0gdjUgd2l0aCBSQkFDIGF1dGhvcml6YXRpb24nLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBDQVRFR09SSUVTX1RBQkxFOiBjYXRlZ29yaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjYXRlZ29yaWVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNhdGVnb3JpZXNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoY2F0ZWdvcmllc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLmdyYW50UmVhZERhdGEoY2F0ZWdvcmllc0xhbWJkYSk7XG5cbiAgICAvLyBXT0RzIHNlcnZpY2VcbiAgICBjb25zdCB3b2RzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnV29kc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvd29kcycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdXT0RzIHNlcnZpY2UgLSB2Ni4yIHdpdGggb3JnYW5pemF0aW9uLW9ubHkgZWRpdGluZyByZXN0cmljdGlvbnMnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBXT0RTX1RBQkxFOiB3b2RzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05TX1RBQkxFOiBvcmdhbml6YXRpb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTQ09SRVNfVEFCTEU6IHNjb3Jlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgd29kc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh3b2RzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25zVGFibGUuZ3JhbnRSZWFkRGF0YSh3b2RzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25FdmVudHNUYWJsZS5ncmFudFJlYWREYXRhKHdvZHNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbk1lbWJlcnNUYWJsZS5ncmFudFJlYWREYXRhKHdvZHNMYW1iZGEpO1xuICAgIHNjb3Jlc1RhYmxlLmdyYW50UmVhZERhdGEod29kc0xhbWJkYSk7XG5cbiAgICAvLyBVc2VycyBzZXJ2aWNlXG4gICAgY29uc3QgdXNlcnNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVc2Vyc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYXRobGV0ZXMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDEwLCAgLy8gUHJldmVudCBydW5hd2F5IGNvc3RzXG4gICAgICBkZXNjcmlwdGlvbjogJ0F0aGxldGVzIHNlcnZpY2UgLSB2MyB3aXRoIFJCQUMgYXV0aG9yaXphdGlvbicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEFUSExFVEVTX1RBQkxFOiBhdGhsZXRlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVRITEVURV9FVkVOVFNfVEFCTEU6IGF0aGxldGVFdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1c2Vyc0xhbWJkYSk7XG4gICAgYXRobGV0ZUV2ZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1c2Vyc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLmdyYW50UmVhZERhdGEodXNlcnNMYW1iZGEpO1xuXG4gICAgLy8gQW5hbHl0aWNzIHNlcnZpY2VcbiAgICBjb25zdCBhbmFseXRpY3NMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBbmFseXRpY3NMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdhbmFseXRpY3MuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9zaGFyZWQnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FuYWx5dGljcyBzZXJ2aWNlIHdpdGggb3JnYW5pemF0aW9uIGZpbHRlcmluZyAtIHYxJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgRVZFTlRTX1RBQkxFOiBldmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFUSExFVEVTX1RBQkxFOiBhdGhsZXRlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVRITEVURV9FVkVOVFNfVEFCTEU6IGF0aGxldGVFdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIENBVEVHT1JJRVNfVEFCTEU6IGNhdGVnb3JpZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFdPRFNfVEFCTEU6IHdvZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFNDT1JFU19UQUJMRTogc2NvcmVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBldmVudHNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG4gICAgYXRobGV0ZXNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG4gICAgYXRobGV0ZUV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcbiAgICBjYXRlZ29yaWVzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuICAgIHdvZHNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG4gICAgc2NvcmVzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuXG4gICAgLy8gU2Vzc2lvbnMgc2VydmljZVxuICAgIGNvbnN0IHNlc3Npb25zTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2Vzc2lvbnNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzZXNzaW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL3NjaGVkdWxpbmcnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDEwLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBTRVNTSU9OU19UQUJMRTogc2Vzc2lvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNlc3Npb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHNlc3Npb25zTGFtYmRhKTtcblxuICAgIC8vIFN0ZXAgRnVuY3Rpb25zIFRhc2sgTGFtYmRhIEZ1bmN0aW9uc1xuICAgIGNvbnN0IGdldEV2ZW50RGF0YUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldEV2ZW50RGF0YUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2dldC1ldmVudC1kYXRhLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvc2hhcmVkJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVWRU5UU19UQUJMRTogZXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9EQVlTX1RBQkxFOiBldmVudERheXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0QXRobGV0ZXNEYXRhTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0QXRobGV0ZXNEYXRhTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0LWF0aGxldGVzLWRhdGEuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hdGhsZXRlcycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBBVEhMRVRFU19UQUJMRTogYXRobGV0ZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFUSExFVEVfRVZFTlRTX1RBQkxFOiBhdGhsZXRlRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldENhdGVnb3JpZXNEYXRhTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0Q2F0ZWdvcmllc0RhdGFMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdnZXQtY2F0ZWdvcmllcy1kYXRhLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY2F0ZWdvcmllcycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBDQVRFR09SSUVTX1RBQkxFOiBjYXRlZ29yaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFdvZHNEYXRhTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0V29kc0RhdGFMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdnZXQtd29kcy1kYXRhLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvd29kcycpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBXT0RTX1RBQkxFOiB3b2RzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdlbmVyYXRlU2NoZWR1bGVMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZW5lcmF0ZVNjaGVkdWxlTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZ2VuZXJhdGUtc2NoZWR1bGUuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jb21wZXRpdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBTQ0hFRFVMRVNfVEFCTEU6IHNjaGVkdWxlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9uc1xuICAgIGV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0RXZlbnREYXRhTGFtYmRhKTtcbiAgICBldmVudERheXNUYWJsZS5ncmFudFJlYWREYXRhKGdldEV2ZW50RGF0YUxhbWJkYSk7XG4gICAgYXRobGV0ZXNUYWJsZS5ncmFudFJlYWREYXRhKGdldEF0aGxldGVzRGF0YUxhbWJkYSk7XG4gICAgYXRobGV0ZUV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0QXRobGV0ZXNEYXRhTGFtYmRhKTtcbiAgICBjYXRlZ29yaWVzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRDYXRlZ29yaWVzRGF0YUxhbWJkYSk7XG4gICAgd29kc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0V29kc0RhdGFMYW1iZGEpO1xuICAgIHNjaGVkdWxlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShnZW5lcmF0ZVNjaGVkdWxlTGFtYmRhKTtcblxuICAgIC8vIFN0ZXAgRnVuY3Rpb25zIEV4cHJlc3MgV29ya2Zsb3dcbiAgICBjb25zdCBnZXRFdmVudERhdGFUYXNrID0gbmV3IHN0ZXBmdW5jdGlvbnNUYXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0dldEV2ZW50RGF0YVRhc2snLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogZ2V0RXZlbnREYXRhTGFtYmRhLFxuICAgICAgcmVzdWx0UGF0aDogJyQuZXZlbnRSZXN1bHQnXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRBdGhsZXRlc0RhdGFUYXNrID0gbmV3IHN0ZXBmdW5jdGlvbnNUYXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0dldEF0aGxldGVzRGF0YVRhc2snLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogZ2V0QXRobGV0ZXNEYXRhTGFtYmRhLFxuICAgICAgcmVzdWx0UGF0aDogJyQuYXRobGV0ZXNSZXN1bHQnXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRDYXRlZ29yaWVzRGF0YVRhc2sgPSBuZXcgc3RlcGZ1bmN0aW9uc1Rhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnR2V0Q2F0ZWdvcmllc0RhdGFUYXNrJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IGdldENhdGVnb3JpZXNEYXRhTGFtYmRhLFxuICAgICAgcmVzdWx0UGF0aDogJyQuY2F0ZWdvcmllc1Jlc3VsdCdcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFdvZHNEYXRhVGFzayA9IG5ldyBzdGVwZnVuY3Rpb25zVGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdHZXRXb2RzRGF0YVRhc2snLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogZ2V0V29kc0RhdGFMYW1iZGEsXG4gICAgICByZXN1bHRQYXRoOiAnJC53b2RzUmVzdWx0J1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ2VuZXJhdGVTY2hlZHVsZVRhc2sgPSBuZXcgc3RlcGZ1bmN0aW9uc1Rhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnR2VuZXJhdGVTY2hlZHVsZVRhc2snLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogZ2VuZXJhdGVTY2hlZHVsZUxhbWJkYSxcbiAgICAgIHBheWxvYWQ6IHN0ZXBmdW5jdGlvbnMuVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAnZXZlbnRJZC4kJzogJyRbMF0uZXZlbnRJZCcsXG4gICAgICAgICdjb25maWcuJCc6ICckWzBdLmNvbmZpZycsXG4gICAgICAgICdldmVudERhdGEuJCc6ICckWzBdLmV2ZW50UmVzdWx0LlBheWxvYWQuZXZlbnREYXRhJyxcbiAgICAgICAgJ2RheXMuJCc6ICckWzBdLmV2ZW50UmVzdWx0LlBheWxvYWQuZGF5cycsXG4gICAgICAgICdhdGhsZXRlcy4kJzogJyRbMV0uYXRobGV0ZXNSZXN1bHQuUGF5bG9hZC5hdGhsZXRlcycsXG4gICAgICAgICdjYXRlZ29yaWVzLiQnOiAnJFsyXS5jYXRlZ29yaWVzUmVzdWx0LlBheWxvYWQuY2F0ZWdvcmllcycsXG4gICAgICAgICd3b2RzLiQnOiAnJFszXS53b2RzUmVzdWx0LlBheWxvYWQud29kcydcbiAgICAgIH0pLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCdcbiAgICB9KTtcblxuICAgIC8vIFBhcmFsbGVsIGRhdGEgY29sbGVjdGlvblxuICAgIGNvbnN0IHBhcmFsbGVsRGF0YUNvbGxlY3Rpb24gPSBuZXcgc3RlcGZ1bmN0aW9ucy5QYXJhbGxlbCh0aGlzLCAnUGFyYWxsZWxEYXRhQ29sbGVjdGlvbicpXG4gICAgICAuYnJhbmNoKGdldEV2ZW50RGF0YVRhc2spXG4gICAgICAuYnJhbmNoKGdldEF0aGxldGVzRGF0YVRhc2spXG4gICAgICAuYnJhbmNoKGdldENhdGVnb3JpZXNEYXRhVGFzaylcbiAgICAgIC5icmFuY2goZ2V0V29kc0RhdGFUYXNrKTtcblxuICAgIGNvbnN0IHNjaGVkdWxlcldvcmtmbG93ID0gcGFyYWxsZWxEYXRhQ29sbGVjdGlvbi5uZXh0KGdlbmVyYXRlU2NoZWR1bGVUYXNrKTtcblxuICAgIC8vIEV4cHJlc3MgU3RhdGUgTWFjaGluZVxuICAgIGNvbnN0IHNjaGVkdWxlclN0YXRlTWFjaGluZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSh0aGlzLCAnU2NoZWR1bGVyU3RhdGVNYWNoaW5lJywge1xuICAgICAgZGVmaW5pdGlvbkJvZHk6IHN0ZXBmdW5jdGlvbnMuRGVmaW5pdGlvbkJvZHkuZnJvbUNoYWluYWJsZShzY2hlZHVsZXJXb3JrZmxvdyksXG4gICAgICBzdGF0ZU1hY2hpbmVUeXBlOiBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZVR5cGUuRVhQUkVTUyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDIpXG4gICAgfSk7XG5cbiAgICAvLyBEREQtQ29tcGxpYW50IFNjaGVkdWxlciBMYW1iZGFcbiAgICBjb25zdCBzY2hlZHVsZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTY2hlZHVsZXJMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzY2hlZHVsZXItc3RlcGZ1bmN0aW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NvbXBldGl0aW9ucycpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdEREQtY29tcGxpYW50IENvbXBldGl0aW9uIFNjaGVkdWxlciBTZXJ2aWNlIC0gdjguMCcsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNDSEVEVUxFU19UQUJMRTogc2NoZWR1bGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTQ0hFRFVMRVJfU1RBVEVfTUFDSElORV9BUk46IHNjaGVkdWxlclN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIG93bmVkIHRhYmxlIChTY2hlZHVsZSBib3VuZGVkIGNvbnRleHQpXG4gICAgc2NoZWR1bGVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHNjaGVkdWxlckxhbWJkYSk7XG4gICAgXG4gICAgLy8gR3JhbnQgU3RlcCBGdW5jdGlvbnMgZXhlY3V0aW9uIHBlcm1pc3Npb25cbiAgICBzY2hlZHVsZXJTdGF0ZU1hY2hpbmUuZ3JhbnRTdGFydFN5bmNFeGVjdXRpb24oc2NoZWR1bGVyTGFtYmRhKTtcbiAgICBcbiAgICAvLyBHcmFudCBFdmVudEJyaWRnZSBwZXJtaXNzaW9ucyBmb3IgZG9tYWluIGV2ZW50c1xuICAgIHNjaGVkdWxlckxhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpldmVudHM6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmV2ZW50LWJ1cy9kZWZhdWx0YF1cbiAgICB9KSk7XG5cbiAgICAvLyBEREQgU2NoZWR1bGVyIExhbWJkYSAoc2VwYXJhdGUgZnJvbSBTdGVwIEZ1bmN0aW9ucyBzY2hlZHVsZXIpXG4gICAgY29uc3QgZGRkU2NoZWR1bGVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnREREU2NoZWR1bGVyTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZGRkLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9zY2hlZHVsaW5nJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0RERCBTY2hlZHVsZXIgLSB2MiB3aXRoIFJCQUMgYXV0aG9yaXphdGlvbicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNDSEVEVUxFU19UQUJMRTogc2NoZWR1bGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBIRUFUU19UQUJMRTogaGVhdHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIENMQVNTSUZJQ0FUSU9OX0ZJTFRFUlNfVEFCTEU6IGNsYXNzaWZpY2F0aW9uRmlsdGVyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX0VWRU5UU19UQUJMRTogb3JnYW5pemF0aW9uRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fTUVNQkVSU19UQUJMRTogb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIERERCBzY2hlZHVsZXJcbiAgICBzY2hlZHVsZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZGRkU2NoZWR1bGVyTGFtYmRhKTtcbiAgICBoZWF0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkZGRTY2hlZHVsZXJMYW1iZGEpO1xuICAgIGNsYXNzaWZpY2F0aW9uRmlsdGVyc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkZGRTY2hlZHVsZXJMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoZGRkU2NoZWR1bGVyTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShkZGRTY2hlZHVsZXJMYW1iZGEpO1xuXG4gICAgLy8gUHVibGljIFNjaGVkdWxlcyBMYW1iZGEgZm9yIGF0aGxldGUgYWNjZXNzICh1c2VzIERERCBzY2hlZHVsZXIgZm9yIHB1Ymxpc2hlZCBzY2hlZHVsZXMpXG4gICAgY29uc3QgcHVibGljU2NoZWR1bGVzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHVibGljU2NoZWR1bGVzTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAncHVibGljLXNjaGVkdWxlcy1kZGQuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jb21wZXRpdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHVibGljIHNjaGVkdWxlcyBzZXJ2aWNlIGZvciBhdGhsZXRlIGFjY2VzcyAtIERERCB2Mi4wJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgU0NIRURVTEVTX1RBQkxFOiBzY2hlZHVsZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIHNjaGVkdWxlc1RhYmxlLmdyYW50UmVhZERhdGEocHVibGljU2NoZWR1bGVzTGFtYmRhKTtcblxuICAgIC8vIEV2ZW50QnJpZGdlIGhhbmRsZXJzIGZvciBhbGwgZG9tYWluc1xuICAgIGNvbnN0IGV2ZW50c0V2ZW50QnJpZGdlSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0V2ZW50c0V2ZW50QnJpZGdlSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2V2ZW50cy1ldmVudGJyaWRnZS1oYW5kbGVyLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY29tcGV0aXRpb25zJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0V2ZW50cyBkb21haW4gRXZlbnRCcmlkZ2UgaGFuZGxlciAtIHYyJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgRVZFTlRTX1RBQkxFOiBldmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVWRU5UX0RBWVNfVEFCTEU6IGV2ZW50RGF5c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRVZFTlRfQlVTX05BTUU6ICdkZWZhdWx0JyxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgZXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShldmVudHNFdmVudEJyaWRnZUhhbmRsZXIpO1xuICAgIGV2ZW50RGF5c1RhYmxlLmdyYW50UmVhZERhdGEoZXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyKTtcbiAgICBldmVudHNFdmVudEJyaWRnZUhhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgIH0pKTtcblxuICAgIGNvbnN0IGF0aGxldGVzRXZlbnRCcmlkZ2VIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXRobGV0ZXNFdmVudEJyaWRnZUhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdhdGhsZXRlcy1ldmVudGJyaWRnZS1oYW5kbGVyLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvY29tcGV0aXRpb25zJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0F0aGxldGVzIGRvbWFpbiBFdmVudEJyaWRnZSBoYW5kbGVyIC0gdjEnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBBVEhMRVRFU19UQUJMRTogYXRobGV0ZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFUSExFVEVfRVZFTlRTX1RBQkxFOiBhdGhsZXRlRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9CVVNfTkFNRTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZERhdGEoYXRobGV0ZXNFdmVudEJyaWRnZUhhbmRsZXIpO1xuICAgIGF0aGxldGVFdmVudHNUYWJsZS5ncmFudFJlYWREYXRhKGF0aGxldGVzRXZlbnRCcmlkZ2VIYW5kbGVyKTtcbiAgICBhdGhsZXRlc0V2ZW50QnJpZGdlSGFuZGxlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgY29uc3QgY2F0ZWdvcmllc0V2ZW50QnJpZGdlSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NhdGVnb3JpZXNFdmVudEJyaWRnZUhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjYXRlZ29yaWVzLWV2ZW50YnJpZGdlLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jb21wZXRpdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2F0ZWdvcmllcyBkb21haW4gRXZlbnRCcmlkZ2UgaGFuZGxlciAtIHYxJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgQ0FURUdPUklFU19UQUJMRTogY2F0ZWdvcmllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRVZFTlRfQlVTX05BTUU6ICdkZWZhdWx0JyxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgY2F0ZWdvcmllc1RhYmxlLmdyYW50UmVhZERhdGEoY2F0ZWdvcmllc0V2ZW50QnJpZGdlSGFuZGxlcik7XG4gICAgY2F0ZWdvcmllc0V2ZW50QnJpZGdlSGFuZGxlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgY29uc3Qgd29kc0V2ZW50QnJpZGdlSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1dvZHNFdmVudEJyaWRnZUhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICd3b2RzLWV2ZW50YnJpZGdlLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9jb21wZXRpdGlvbnMnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV09EcyBkb21haW4gRXZlbnRCcmlkZ2UgaGFuZGxlciAtIHYxJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgV09EU19UQUJMRTogd29kc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRVZFTlRfQlVTX05BTUU6ICdkZWZhdWx0JyxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgd29kc1RhYmxlLmdyYW50UmVhZERhdGEod29kc0V2ZW50QnJpZGdlSGFuZGxlcik7XG4gICAgd29kc0V2ZW50QnJpZGdlSGFuZGxlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2UgcnVsZXMgZm9yIGRvbWFpbiBldmVudCBoYW5kbGVyc1xuICAgIGNvbnN0IGV2ZW50QnVzID0gZXZlbnRicmlkZ2UuRXZlbnRCdXMuZnJvbUV2ZW50QnVzTmFtZSh0aGlzLCAnRGVmYXVsdEV2ZW50QnVzJywgJ2RlZmF1bHQnKTtcbiAgICBcbiAgICAvLyBSdWxlcyBmb3IgZGF0YSByZXF1ZXN0cyBmcm9tIHNjaGVkdWxlciBvcmNoZXN0cmF0b3JcbiAgICBuZXcgZXZlbnRicmlkZ2UuUnVsZSh0aGlzLCAnRXZlbnREYXRhUmVxdWVzdFJ1bGUnLCB7XG4gICAgICBldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnc2NoZWR1bGVyLm9yY2hlc3RyYXRvciddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0V2ZW50IERhdGEgUmVxdWVzdGVkJ11cbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oZXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyKV1cbiAgICB9KTtcblxuICAgIG5ldyBldmVudGJyaWRnZS5SdWxlKHRoaXMsICdBdGhsZXRlc0RhdGFSZXF1ZXN0UnVsZScsIHtcbiAgICAgIGV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydzY2hlZHVsZXIub3JjaGVzdHJhdG9yJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnQXRobGV0ZXMgRGF0YSBSZXF1ZXN0ZWQnXVxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhdGhsZXRlc0V2ZW50QnJpZGdlSGFuZGxlcildXG4gICAgfSk7XG5cbiAgICBuZXcgZXZlbnRicmlkZ2UuUnVsZSh0aGlzLCAnQ2F0ZWdvcmllc0RhdGFSZXF1ZXN0UnVsZScsIHtcbiAgICAgIGV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydzY2hlZHVsZXIub3JjaGVzdHJhdG9yJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnQ2F0ZWdvcmllcyBEYXRhIFJlcXVlc3RlZCddXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGNhdGVnb3JpZXNFdmVudEJyaWRnZUhhbmRsZXIpXVxuICAgIH0pO1xuXG4gICAgbmV3IGV2ZW50YnJpZGdlLlJ1bGUodGhpcywgJ1dvZHNEYXRhUmVxdWVzdFJ1bGUnLCB7XG4gICAgICBldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnc2NoZWR1bGVyLm9yY2hlc3RyYXRvciddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ1dPRHMgRGF0YSBSZXF1ZXN0ZWQnXVxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih3b2RzRXZlbnRCcmlkZ2VIYW5kbGVyKV1cbiAgICB9KTtcblxuICAgIC8vIFJ1bGVzIGZvciBkb21haW4gcmVzcG9uc2VzIGJhY2sgdG8gc2NoZWR1bGVyIG9yY2hlc3RyYXRvclxuICAgIG5ldyBldmVudGJyaWRnZS5SdWxlKHRoaXMsICdEb21haW5SZXNwb25zZXNSdWxlJywge1xuICAgICAgZXZlbnRCdXMsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2V2ZW50cy5kb21haW4nLCAnYXRobGV0ZXMuZG9tYWluJywgJ2NhdGVnb3JpZXMuZG9tYWluJywgJ3dvZHMuZG9tYWluJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnRXZlbnQgRGF0YSBSZXNwb25zZScsICdBdGhsZXRlcyBEYXRhIFJlc3BvbnNlJywgJ0NhdGVnb3JpZXMgRGF0YSBSZXNwb25zZScsICdXT0RzIERhdGEgUmVzcG9uc2UnXVxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzY2hlZHVsZXJMYW1iZGEpXVxuICAgIH0pO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2UgZm9yIGRlY291cGxlZCBsZWFkZXJib2FyZCBjYWxjdWxhdGlvbnNcbiAgICBjb25zdCBsZWFkZXJib2FyZENhbGN1bGF0b3IgPSBuZXcgRXZlbnRicmlkZ2VUb0xhbWJkYSh0aGlzLCAnTGVhZGVyYm9hcmRDYWxjdWxhdG9yJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb25Qcm9wczoge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgICAgaGFuZGxlcjogJ2xlYWRlcmJvYXJkLWNhbGN1bGF0b3ItZW5oYW5jZWQuaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2NvbXBldGl0aW9ucycpLFxuICAgICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIFNDT1JFU19UQUJMRTogc2NvcmVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIExFQURFUkJPQVJEX1RBQkxFOiBsZWFkZXJib2FyZENhY2hlVGFibGUudGFibGVOYW1lLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGV2ZW50UnVsZVByb3BzOiB7XG4gICAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICAgIHNvdXJjZTogWydzY29yaW5nYW1lcy5zY29yZXMnXSxcbiAgICAgICAgICBkZXRhaWxUeXBlOiBbJ1Njb3JlQ2FsY3VsYXRlZCddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzY29yZXNUYWJsZS5ncmFudFJlYWREYXRhKGxlYWRlcmJvYXJkQ2FsY3VsYXRvci5sYW1iZGFGdW5jdGlvbik7XG4gICAgbGVhZGVyYm9hcmRDYWNoZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsZWFkZXJib2FyZENhbGN1bGF0b3IubGFtYmRhRnVuY3Rpb24pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgd2l0aCBtaWNyb3NlcnZpY2VzIHJvdXRpbmdcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdDYWxpc3RoZW5pY3NBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ0NhbGlzdGhlbmljcyBDb21wZXRpdGlvbiBBUEknLFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICB0aHJvdHRsaW5nQnVyc3RMaW1pdDogMTAwLCAgLy8gTWF4IGNvbmN1cnJlbnQgcmVxdWVzdHNcbiAgICAgICAgdGhyb3R0bGluZ1JhdGVMaW1pdDogNTAsICAgIC8vIFJlcXVlc3RzIHBlciBzZWNvbmRcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb2duaXRvQXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF0sXG4gICAgfSk7XG5cbiAgICAvLyBQdWJsaWMgZW5kcG9pbnQgZm9yIHB1Ymxpc2hlZCBldmVudHMgLSAvcHVibGljL2V2ZW50cyAobm8gYXV0aCByZXF1aXJlZClcbiAgICBjb25zdCBwdWJsaWNSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdwdWJsaWMnLCB7XG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ09QVElPTlMnXSxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgcHVibGljRXZlbnRzID0gcHVibGljUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2V2ZW50cycpO1xuICAgIHB1YmxpY0V2ZW50cy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNvbXBldGl0aW9uc0xhbWJkYSkpO1xuICAgIGNvbnN0IHB1YmxpY0V2ZW50c1Byb3h5ID0gcHVibGljRXZlbnRzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHB1YmxpY0V2ZW50c1Byb3h5LmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY29tcGV0aXRpb25zTGFtYmRhKSk7XG5cbiAgICAvLyBQdWJsaWMgZW5kcG9pbnQgZm9yIHB1Ymxpc2hlZCBzY2hlZHVsZXMgLSAvcHVibGljL3NjaGVkdWxlcyAobm8gYXV0aCByZXF1aXJlZClcbiAgICBjb25zdCBwdWJsaWNTY2hlZHVsZXMgPSBwdWJsaWNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc2NoZWR1bGVzJyk7XG4gICAgcHVibGljU2NoZWR1bGVzLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHVibGljU2NoZWR1bGVzTGFtYmRhKSk7XG4gICAgY29uc3QgcHVibGljU2NoZWR1bGVzUHJveHkgPSBwdWJsaWNTY2hlZHVsZXMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgcHVibGljU2NoZWR1bGVzUHJveHkuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwdWJsaWNTY2hlZHVsZXNMYW1iZGEpKTtcblxuICAgIC8vIFB1YmxpYyBlbmRwb2ludCBmb3Igc2NvcmVzIC0gL3B1YmxpYy9zY29yZXMgKG5vIGF1dGggcmVxdWlyZWQpXG4gICAgY29uc3QgcHVibGljU2NvcmVzID0gcHVibGljUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Njb3JlcycpO1xuICAgIHB1YmxpY1Njb3Jlcy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNjb3Jlc0xhbWJkYSkpO1xuXG4gICAgLy8gQ29tcGV0aXRpb25zIG1pY3Jvc2VydmljZSAtIC9jb21wZXRpdGlvbnMvKiAoYXV0aCByZXF1aXJlZClcbiAgICBjb25zdCBjb21wZXRpdGlvbnMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnY29tcGV0aXRpb25zJyk7XG4gICAgY29tcGV0aXRpb25zLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY29tcGV0aXRpb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBjb21wZXRpdGlvbnNQcm94eSA9IGNvbXBldGl0aW9ucy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBjb21wZXRpdGlvbnNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNvbXBldGl0aW9uc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBPcmdhbml6YXRpb25zIG1pY3Jvc2VydmljZSAtIC9vcmdhbml6YXRpb25zLypcbiAgICBjb25zdCBvcmdhbml6YXRpb25zID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ29yZ2FuaXphdGlvbnMnKTtcbiAgICBvcmdhbml6YXRpb25zLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3JnYW5pemF0aW9uc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3Qgb3JnYW5pemF0aW9uc1Byb3h5ID0gb3JnYW5pemF0aW9ucy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBvcmdhbml6YXRpb25zUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvcmdhbml6YXRpb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIEV2ZW50cyBtaWNyb3NlcnZpY2UgLSAvZXZlbnRzLypcbiAgICBjb25zdCBldmVudHMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnZXZlbnRzJyk7XG4gICAgZXZlbnRzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZXZlbnRzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBldmVudHNQcm94eSA9IGV2ZW50cy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBldmVudHNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGV2ZW50c0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBTY29yZXMgbWljcm9zZXJ2aWNlIC0gL3Njb3Jlcy8qXG4gICAgY29uc3Qgc2NvcmVzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Njb3JlcycpO1xuICAgIHNjb3Jlcy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNjb3Jlc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3Qgc2NvcmVzUHJveHkgPSBzY29yZXMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgc2NvcmVzUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzY29yZXNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gRXhlcmNpc2UgTGlicmFyeSBtaWNyb3NlcnZpY2UgLSAvZXhlcmNpc2VzLypcbiAgICBjb25zdCBleGVyY2lzZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnZXhlcmNpc2VzJyk7XG4gICAgZXhlcmNpc2VzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZXhlcmNpc2VMaWJyYXJ5TGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBleGVyY2lzZXNQcm94eSA9IGV4ZXJjaXNlcy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBleGVyY2lzZXNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGV4ZXJjaXNlTGlicmFyeUxhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBMZWFkZXJib2FyZCBBUEkgLSAvbGVhZGVyYm9hcmQgKHB1YmxpYyBlbmRwb2ludClcbiAgICBjb25zdCBsZWFkZXJib2FyZCA9IGFwaS5yb290LmFkZFJlc291cmNlKCdsZWFkZXJib2FyZCcpO1xuICAgIGxlYWRlcmJvYXJkLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGVhZGVyYm9hcmRBcGlMYW1iZGEpKTtcblxuICAgIC8vIENhdGVnb3JpZXMgbWljcm9zZXJ2aWNlIC0gL2NhdGVnb3JpZXMvKlxuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnY2F0ZWdvcmllcycpO1xuICAgIGNhdGVnb3JpZXMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjYXRlZ29yaWVzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBjYXRlZ29yaWVzUHJveHkgPSBjYXRlZ29yaWVzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIGNhdGVnb3JpZXNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNhdGVnb3JpZXNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gV09EcyBtaWNyb3NlcnZpY2UgLSAvd29kcy8qXG4gICAgY29uc3Qgd29kcyA9IGFwaS5yb290LmFkZFJlc291cmNlKCd3b2RzJyk7XG4gICAgd29kcy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHdvZHNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IHdvZHNQcm94eSA9IHdvZHMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgd29kc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24od29kc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBVc2VycyBtaWNyb3NlcnZpY2UgLSAvbWUvKiBhbmQgL3VzZXJzLyogYW5kIC9hdGhsZXRlcy8qXG4gICAgY29uc3QgbWUgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnbWUnKTtcbiAgICBtZS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBtZVByb3h5ID0gbWUuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgbWVQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIGNvbnN0IHVzZXJzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VzZXJzJyk7XG4gICAgdXNlcnMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgdXNlcnNQcm94eSA9IHVzZXJzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHVzZXJzUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBMZWdhY3kgL2F0aGxldGVzIHJvdXRlIChtYXBzIHRvIHVzZXJzIExhbWJkYSlcbiAgICBjb25zdCBhdGhsZXRlcyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdhdGhsZXRlcycpO1xuICAgIGF0aGxldGVzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IGF0aGxldGVzUHJveHkgPSBhdGhsZXRlcy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBhdGhsZXRlc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gU2Vzc2lvbnMgbWljcm9zZXJ2aWNlIC0gL3Nlc3Npb25zLypcbiAgICBjb25zdCBzZXNzaW9ucyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzZXNzaW9ucycpO1xuICAgIHNlc3Npb25zLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IHNlc3Npb25zUHJveHkgPSBzZXNzaW9ucy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBzZXNzaW9uc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gU2NoZWR1bGVyIG1pY3Jvc2VydmljZSAtIC9zY2hlZHVsZXIvKiAoREREIHNjaGVkdWxlciB3aXRoIFJCQUMpXG4gICAgY29uc3Qgc2NoZWR1bGVyID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3NjaGVkdWxlcicpO1xuICAgIHNjaGVkdWxlci5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ2F0ZXdheS5Nb2NrSW50ZWdyYXRpb24oe1xuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nXCIsXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcIixcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgIH1cbiAgICAgIH1dLFxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XCJzdGF0dXNDb2RlXCI6IDIwMH0nXG4gICAgICB9XG4gICAgfSksIHtcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9KTtcbiAgICBzY2hlZHVsZXIuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihkZGRTY2hlZHVsZXJMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IHNjaGVkdWxlclByb3h5ID0gc2NoZWR1bGVyLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHNjaGVkdWxlclByb3h5LmFkZE1ldGhvZCgnT1BUSU9OUycsIG5ldyBhcGlnYXRld2F5Lk1vY2tJbnRlZ3JhdGlvbih7XG4gICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW3tcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidcIixcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ1wiLFxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgfVxuICAgICAgfV0sXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfSdcbiAgICAgIH1cbiAgICB9KSwge1xuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbe1xuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWUsXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0pO1xuICAgIHNjaGVkdWxlclByb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGRkU2NoZWR1bGVyTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIEFuYWx5dGljcyBtaWNyb3NlcnZpY2UgLSAvYW5hbHl0aWNzLypcbiAgICBjb25zdCBhbmFseXRpY3MgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XG4gICAgYW5hbHl0aWNzLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYW5hbHl0aWNzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHsgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7IHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7IHZhbHVlOiBhcGkudXJsIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJzaXRlVXJsJywgeyB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0V2ZW50SW1hZ2VzQnVja2V0TmFtZScsIHsgdmFsdWU6IGV2ZW50SW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHsgdmFsdWU6IHdlYnNpdGVCdWNrZXQuYnVja2V0TmFtZSB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uSWQnLCB7IHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQgfSk7XG4gICAgXG4gICAgLy8gREREIFNjaGVkdWxlciBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RERFNjaGVkdWxlckxhbWJkYUFybicsIHtcbiAgICAgIHZhbHVlOiBzY2hlZHVsZXJMYW1iZGEuZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0RERC1jb21wbGlhbnQgU2NoZWR1bGVyIExhbWJkYSBBUk4nXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NjaGVkdWxlckVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IGAke2FwaS51cmx9c2NoZWR1bGVyL2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RERCBTY2hlZHVsZXIgQVBJIGVuZHBvaW50J1xuICAgIH0pO1xuICAgIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZENvbmZpZycsIHtcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFwaVVybDogYXBpLnVybCxcbiAgICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgdXNlclBvb2xDbGllbnRJZDogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIH0pLFxuICAgIH0pO1xuICB9XG59XG4iXX0=