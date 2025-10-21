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
            code: lambda.Code.fromAsset('lambda'),
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
        // Competitions service - Handles competitions and public events endpoints
        const competitionsLambda = new lambda.Function(this, 'CompetitionsLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'competitions.handler',
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            environment: {
                ...commonEnv,
                EVENT_DAYS_TABLE: eventDaysTable.tableName,
                EVENT_IMAGES_BUCKET: eventImagesBucket.bucketName,
            },
        });
        eventDaysTable.grantReadWriteData(eventsLambda);
        eventImagesBucket.grantReadWrite(eventsLambda);
        // Scores service
        const scoresLambda = new lambda.Function(this, 'ScoresLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'scores.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            description: 'Scores service with query parameter support - v2',
            environment: {
                ...commonEnv,
                SCORES_TABLE: scoresTable.tableName,
                ATHLETES_TABLE: athletesTable.tableName,
            },
        });
        scoresTable.grantReadWriteData(scoresLambda);
        athletesTable.grantReadData(scoresLambda);
        scoresLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: ['*'],
        }));
        // Categories service
        const categoriesLambda = new lambda.Function(this, 'CategoriesLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'categories.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            description: 'Categories service with fixed CORS and auth - v4',
            environment: {
                ...commonEnv,
                CATEGORIES_TABLE: categoriesTable.tableName,
                ORGANIZATION_EVENTS_TABLE: organizationEventsTable.tableName,
            },
        });
        categoriesTable.grantReadWriteData(categoriesLambda);
        organizationEventsTable.grantReadData(categoriesLambda);
        // WODs service
        const wodsLambda = new lambda.Function(this, 'WodsLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'wods.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            description: 'WODs service - DDD compliant - v3',
            environment: {
                ...commonEnv,
                WODS_TABLE: wodsTable.tableName,
            },
        });
        wodsTable.grantReadWriteData(wodsLambda);
        // Users service
        const usersLambda = new lambda.Function(this, 'UsersLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'users.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            reservedConcurrentExecutions: 10, // Prevent runaway costs
            description: 'Users service with athlete profile update support - v2',
            environment: {
                ...commonEnv,
                ATHLETES_TABLE: athletesTable.tableName,
                ATHLETE_EVENTS_TABLE: athleteEventsTable.tableName,
            },
        });
        athletesTable.grantReadWriteData(usersLambda);
        athleteEventsTable.grantReadWriteData(usersLambda);
        // Analytics service
        const analyticsLambda = new lambda.Function(this, 'AnalyticsLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'analytics.handler',
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            handler: 'scheduler-ddd.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 512,
            timeout: cdk.Duration.seconds(30),
            description: 'DDD-compliant Competition Scheduler Service - v6.0',
            environment: {
                ...commonEnv,
                SCHEDULES_TABLE: schedulesTable.tableName,
                // EventBridge for domain events
                EVENT_BUS_NAME: 'default',
            },
        });
        // Grant permissions to owned table (Schedule bounded context)
        schedulesTable.grantReadWriteData(schedulerLambda);
        // Grant read-only access to external bounded contexts
        eventsTable.grantReadData(schedulerLambda);
        eventDaysTable.grantReadData(schedulerLambda);
        categoriesTable.grantReadData(schedulerLambda);
        wodsTable.grantReadData(schedulerLambda);
        athleteEventsTable.grantReadData(schedulerLambda);
        athletesTable.grantReadData(schedulerLambda);
        // Grant EventBridge permissions for domain events
        schedulerLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['events:PutEvents'],
            resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/default`]
        }));
        // Public Schedules Lambda for athlete access (uses DDD scheduler for published schedules)
        const publicSchedulesLambda = new lambda.Function(this, 'PublicSchedulesLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'public-schedules-ddd.handler',
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
            code: lambda.Code.fromAsset('lambda'),
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
        // Tournament Results Table
        const tournamentResultsTable = new dynamodb.Table(this, 'TournamentResultsTable', {
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.ON_DEMAND,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Tournament Leaderboard Table
        const tournamentLeaderboardTable = new dynamodb.Table(this, 'TournamentLeaderboardTable', {
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.ON_DEMAND,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Tournament Results Service
        const tournamentResultsLambda = new lambda.Function(this, 'TournamentResultsLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'tournament-results.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            environment: {
                TOURNAMENT_RESULTS_TABLE: tournamentResultsTable.tableName,
                SCHEDULES_TABLE: schedulesTable.tableName,
                SCORES_TABLE: scoresTable.tableName,
            },
        });

        // Tournament Leaderboard Calculator
        const tournamentLeaderboardCalculator = new lambda.Function(this, 'TournamentLeaderboardCalculator', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'tournament-leaderboard-calculator.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            environment: {
                TOURNAMENT_RESULTS_TABLE: tournamentResultsTable.tableName,
                TOURNAMENT_LEADERBOARD_TABLE: tournamentLeaderboardTable.tableName,
                ATHLETES_TABLE: athletesTable.tableName,
            },
        });

        // Tournament Event Handler
        const tournamentEventHandler = new lambda.Function(this, 'TournamentEventHandler', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'tournament-event-handler.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            environment: {
                SCHEDULES_TABLE: schedulesTable.tableName,
            },
        });

        // Grant permissions
        tournamentResultsTable.grantReadWriteData(tournamentResultsLambda);
        tournamentResultsTable.grantReadData(tournamentLeaderboardCalculator);
        tournamentLeaderboardTable.grantReadWriteData(tournamentLeaderboardCalculator);
        schedulesTable.grantReadWriteData(tournamentEventHandler);
        scoresTable.grantReadData(tournamentResultsLambda);
        athletesTable.grantReadData(tournamentLeaderboardCalculator);

        // EventBridge rules for tournament events
        new eventbridge.Rule(this, 'TournamentResultsRule', {
            eventBus,
            eventPattern: {
                source: ['tournament.results'],
                detailType: ['Match Result Submitted', 'Tournament Advanced']
            },
            targets: [
                new targets.LambdaFunction(tournamentEventHandler),
                new targets.LambdaFunction(tournamentLeaderboardCalculator)
            ]
        });

        new eventbridge.Rule(this, 'TournamentLeaderboardRule', {
            eventBus,
            eventPattern: {
                source: ['tournament.schedule'],
                detailType: ['Tournament Leaderboard Update Required']
            },
            targets: [new targets.LambdaFunction(tournamentLeaderboardCalculator)]
        });

        // EventBridge for decoupled leaderboard calculations
        const leaderboardCalculator = new aws_eventbridge_lambda_1.EventbridgeToLambda(this, 'LeaderboardCalculator', {
            lambdaFunctionProps: {
                runtime: lambda.Runtime.NODEJS_18_X,
                handler: 'leaderboard-calculator.handler',
                code: lambda.Code.fromAsset('lambda'),
                memorySize: 512,
                timeout: cdk.Duration.minutes(5),
                environment: {
                    SCORES_TABLE: scoresTable.tableName,
                    ATHLETES_TABLE: athletesTable.tableName,
                    EVENTS_TABLE: eventsTable.tableName,
                },
            },
            eventRuleProps: {
                eventPattern: {
                    source: ['calisthenics.scores'],
                    detailType: ['Score Updated', 'Score Created'],
                },
            },
        });
        scoresTable.grantReadData(leaderboardCalculator.lambdaFunction);
        athletesTable.grantReadData(leaderboardCalculator.lambdaFunction);
        eventsTable.grantReadData(leaderboardCalculator.lambdaFunction);
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
        // Tournament Results microservice - /tournament-results/*
        const tournamentResults = api.root.addResource('tournament-results');
        tournamentResults.addMethod('ANY', new apigateway.LambdaIntegration(tournamentResultsLambda), { authorizer: cognitoAuthorizer });
        const tournamentResultsProxy = tournamentResults.addResource('{proxy+}');
        tournamentResultsProxy.addMethod('ANY', new apigateway.LambdaIntegration(tournamentResultsLambda), { authorizer: cognitoAuthorizer });

        // Tournament Leaderboard microservice - /tournament-leaderboard/*
        const tournamentLeaderboard = api.root.addResource('tournament-leaderboard');
        tournamentLeaderboard.addMethod('ANY', new apigateway.LambdaIntegration(tournamentLeaderboardCalculator), { authorizer: cognitoAuthorizer });
        const tournamentLeaderboardProxy = tournamentLeaderboard.addResource('{proxy+}');
        tournamentLeaderboardProxy.addMethod('ANY', new apigateway.LambdaIntegration(tournamentLeaderboardCalculator), { authorizer: cognitoAuthorizer });

        // Scheduler microservice - /scheduler/* (integrated with competitions)
        // Note: Scheduler routes are handled within competitions Lambda for /competitions/{eventId}/schedule
        // This provides a dedicated scheduler endpoint for advanced operations
        const scheduler = api.root.addResource('scheduler');
        scheduler.addMethod('ANY', new apigateway.LambdaIntegration(schedulerLambda), { authorizer: cognitoAuthorizer });
        const schedulerProxy = scheduler.addResource('{proxy+}');
        schedulerProxy.addMethod('ANY', new apigateway.LambdaIntegration(schedulerLambda), { authorizer: cognitoAuthorizer });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsaXN0aGVuaWNzLWFwcC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNhbGlzdGhlbmljcy1hcHAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLG1EQUFtRDtBQUNuRCxxREFBcUQ7QUFDckQsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCx5Q0FBeUM7QUFDekMseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCxzREFBc0Q7QUFDdEQsMERBQTBEO0FBQzFELDJDQUEyQztBQUUzQywrREFBK0Q7QUFDL0QsMEVBQTBFO0FBQzFFLDZGQUF1RjtBQUd2RixNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsdUNBQXVDO1FBQ3ZDLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDbEUsWUFBWSxFQUFFLG9CQUFvQjtZQUNsQyxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDOUIsa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtnQkFDeEMsU0FBUyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2dCQUM1QyxVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDOUM7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDaEIsSUFBSSxFQUFFLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUs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QWlCLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZHLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0MsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRTVHLDBEQUEwRDtRQUMxRCxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxFQUFFLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDdEcsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMzQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFFM0csTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDNUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQ3pHLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDakQsVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FB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QyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQzFGLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDbkYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUVsRix3QkFBd0I7UUFDeEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsZUFBZSxDQUFDLFdBQVc7WUFDbEMsV0FBVyxFQUFFLG9DQUFvQztTQUNsRCxDQUFDLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLFlBQVk7WUFDN0IsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUc7Z0JBQ2YsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO2dCQUMvQixnQkFBZ0IsRUFBRSxjQUFjLENBQUMsZ0JBQWdCO2dCQUNqRCxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07YUFDcEIsQ0FBQztTQUNILENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTM0QkQsb0RBMjRCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBldmVudGJyaWRnZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc3RlcGZ1bmN0aW9uc1Rhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCB7IEV2ZW50YnJpZGdlVG9MYW1iZGEgfSBmcm9tICdAYXdzLXNvbHV0aW9ucy1jb25zdHJ1Y3RzL2F3cy1ldmVudGJyaWRnZS1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBDYWxpc3RoZW5pY3NBcHBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sIGZvciBhdXRoZW50aWNhdGlvblxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0NhbGlzdGhlbmljc1VzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiAnY2FsaXN0aGVuaWNzLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH0sXG4gICAgICAgIGdpdmVuTmFtZTogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH0sXG4gICAgICB9LFxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICByb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtaW5MZW46IDEsIG1heExlbjogMjAsIG11dGFibGU6IHRydWUgfSksIC8vIExlZ2FjeSAtIGtlcHQgZm9yIGNvbXBhdGliaWxpdHlcbiAgICAgICAgZGl2aXNpb246IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG1pbkxlbjogMSwgbWF4TGVuOiA1MCwgbXV0YWJsZTogdHJ1ZSB9KSwgLy8gTGVnYWN5IC0ga2VwdCBmb3IgY29tcGF0aWJpbGl0eVxuICAgICAgICBpc1N1cGVyQWRtaW46IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG1pbkxlbjogMSwgbWF4TGVuOiA1LCBtdXRhYmxlOiB0cnVlIH0pLCAvLyAndHJ1ZScgb3IgJ2ZhbHNlJ1xuICAgICAgICBvcmdhbml6ZXJSb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtaW5MZW46IDEsIG1heExlbjogMjAsIG11dGFibGU6IHRydWUgfSksIC8vICdzdXBlcl9hZG1pbicsICdldmVudF9hZG1pbicsICdhdXhpbGlhcnlfYWRtaW4nXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ0NhbGlzdGhlbmljc1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2wsXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RCIFRhYmxlcyAtIE11bHRpLXRlbmFudCBhcmNoaXRlY3R1cmUgd2l0aCBldmVudCBpc29sYXRpb25cbiAgICAvLyBVc2luZyBPbi1EZW1hbmQgYmlsbGluZyBmb3IgY29zdCBvcHRpbWl6YXRpb24gYW5kIHVucHJlZGljdGFibGUgdHJhZmZpYyBwYXR0ZXJuc1xuICAgIFxuICAgIC8vIEV2ZW50cyB0YWJsZSAtIE1haW4gZXZlbnRzIChlLmcuLCBcIlN1bW1lciBHYW1lcyAyMDI1XCIpXG4gICAgY29uc3QgZXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0V2ZW50c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIGV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3N0YXR1cy1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N0YXR1cycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzdGFydERhdGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gT3JnYW5pemF0aW9ucyB0YWJsZVxuICAgIGNvbnN0IG9yZ2FuaXphdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnT3JnYW5pemF0aW9uc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdvcmdhbml6YXRpb25JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIE9yZ2FuaXphdGlvbiBNZW1iZXJzIChtYW55LXRvLW1hbnk6IHVzZXJzIHRvIG9yZ2FuaXphdGlvbnMpXG4gICAgY29uc3Qgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdPcmdhbml6YXRpb25NZW1iZXJzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ29yZ2FuaXphdGlvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAndXNlci1vcmdhbml6YXRpb25zLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ29yZ2FuaXphdGlvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIE9yZ2FuaXphdGlvbi1FdmVudCBtYXBwaW5nIChldmVudHMgYmVsb25nIHRvIG9yZ2FuaXphdGlvbnMpXG4gICAgY29uc3Qgb3JnYW5pemF0aW9uRXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ09yZ2FuaXphdGlvbkV2ZW50c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdvcmdhbml6YXRpb25JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2V2ZW50LW9yZ2FuaXphdGlvbi1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gTGVnYWN5OiBLZWVwIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGR1cmluZyBtaWdyYXRpb25cbiAgICBjb25zdCBvcmdhbml6ZXJFdmVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnT3JnYW5pemVyRXZlbnRzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIG9yZ2FuaXplckV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2V2ZW50LW9yZ2FuaXplcnMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBdGhsZXRlLUV2ZW50IHJlZ2lzdHJhdGlvbnMgKG1hbnktdG8tbWFueSlcbiAgICBjb25zdCBhdGhsZXRlRXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0F0aGxldGVFdmVudHNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgYXRobGV0ZUV2ZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2V2ZW50LWF0aGxldGVzLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdyZWdpc3RlcmVkQXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQXRobGV0ZXMgdGFibGUgLSBHbG9iYWwgdXNlciBwcm9maWxlc1xuICAgIGNvbnN0IGF0aGxldGVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0F0aGxldGVzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEV2ZW50IERheXMgdGFibGUgLSBJbmRpdmlkdWFsIGRheXMvc2Vzc2lvbnMgd2l0aGluIGFuIGV2ZW50XG4gICAgY29uc3QgZXZlbnREYXlzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0V2ZW50RGF5c1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2RheUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ2F0ZWdvcmllcyB0YWJsZSAtIEV2ZW50LXNjb3BlZFxuICAgIGNvbnN0IGNhdGVnb3JpZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ2F0ZWdvcmllc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NhdGVnb3J5SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBXT0RzIHRhYmxlIC0gRXZlbnQtc2NvcGVkXG4gICAgY29uc3Qgd29kc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdXb2RzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnd29kSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBTY29yZXMgdGFibGUgLSBFdmVudC1zY29wZWQgd2l0aCBjb21wb3NpdGUga2V5IGZvciBlZmZpY2llbnQgcXVlcmllc1xuICAgIGNvbnN0IHNjb3Jlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTY29yZXNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzY29yZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSwgLy8gRm9ybWF0OiBkYXlJZCNhdGhsZXRlSWRcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICAgIHNjb3Jlc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2RheS1zY29yZXMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdkYXlJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzY29yZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTZXNzaW9ucyB0YWJsZSAtIFVzZXIgc2Vzc2lvbiBtYW5hZ2VtZW50IHdpdGggVFRMXG4gICAgY29uc3Qgc2Vzc2lvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU2Vzc2lvbnNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2Vzc2lvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgc2Vzc2lvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VySWQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIC8vIFNjaGVkdWxlcyB0YWJsZSAtIENvbXBldGl0aW9uIHNjaGVkdWxlc1xuICAgIGNvbnN0IHNjaGVkdWxlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTY2hlZHVsZXNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzY2hlZHVsZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gSGVhdHMgdGFibGUgLSBJbmRpdmlkdWFsIGNvbXBldGl0aW9uIGhlYXRzXG4gICAgY29uc3QgaGVhdHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSGVhdHNUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2NoZWR1bGVJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdoZWF0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDbGFzc2lmaWNhdGlvbiBGaWx0ZXJzIHRhYmxlIC0gRWxpbWluYXRpb24gcnVsZXNcbiAgICBjb25zdCBjbGFzc2lmaWNhdGlvbkZpbHRlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ2xhc3NpZmljYXRpb25GaWx0ZXJzVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZmlsdGVySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBTMyBCdWNrZXQgZm9yIGZyb250ZW5kIGhvc3RpbmdcbiAgICBjb25zdCB3ZWJzaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnV2Vic2l0ZUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBjYWxpc3RoZW5pY3MtYXBwLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gUzMgQnVja2V0IGZvciBldmVudCBpbWFnZXNcbiAgICBjb25zdCBldmVudEltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0V2ZW50SW1hZ2VzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGNhbGlzdGhlbmljcy1ldmVudC1pbWFnZXMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1RdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BQ0xTLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBPcmlnaW4gQWNjZXNzIENvbnRyb2wgKE9BQykgLSBsYXRlc3QgQ0RLIHN5bnRheFxuICAgIGNvbnN0IG9yaWdpbkFjY2Vzc0NvbnRyb2wgPSBuZXcgY2xvdWRmcm9udC5DZm5PcmlnaW5BY2Nlc3NDb250cm9sKHRoaXMsICdPQUMnLCB7XG4gICAgICBvcmlnaW5BY2Nlc3NDb250cm9sQ29uZmlnOiB7XG4gICAgICAgIG5hbWU6ICdjYWxpc3RoZW5pY3MtYXBwLW9hYycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnT0FDIGZvciBDYWxpc3RoZW5pY3MgQXBwJyxcbiAgICAgICAgb3JpZ2luQWNjZXNzQ29udHJvbE9yaWdpblR5cGU6ICdzMycsXG4gICAgICAgIHNpZ25pbmdCZWhhdmlvcjogJ2Fsd2F5cycsXG4gICAgICAgIHNpZ25pbmdQcm90b2NvbDogJ3NpZ3Y0JyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRGlzdHJpYnV0aW9uJywge1xuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbCh3ZWJzaXRlQnVja2V0KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENsb3VkRnJvbnQgYWNjZXNzIHRvIFMzIGJ1Y2tldCB2aWEgYnVja2V0IHBvbGljeVxuICAgIHdlYnNpdGVCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgcmVzb3VyY2VzOiBbd2Vic2l0ZUJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyldLFxuICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY2xvdWRmcm9udC5hbWF6b25hd3MuY29tJyldLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnQVdTOlNvdXJjZUFybic6IGBhcm46YXdzOmNsb3VkZnJvbnQ6OiR7dGhpcy5hY2NvdW50fTpkaXN0cmlidXRpb24vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWR9YCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSkpO1xuXG4gICAgLy8gTWljcm9zZXJ2aWNlczogU2VwYXJhdGUgTGFtYmRhIHBlciBkb21haW5cbiAgICBjb25zdCBjb21tb25FbnYgPSB7XG4gICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgfTtcblxuICAgIC8vIE9yZ2FuaXphdGlvbnMgc2VydmljZVxuICAgIGNvbnN0IG9yZ2FuaXphdGlvbnNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdPcmdhbml6YXRpb25zTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnb3JnYW5pemF0aW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIE9SR0FOSVpBVElPTlNfVEFCTEU6IG9yZ2FuaXphdGlvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIG9yZ2FuaXphdGlvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEob3JnYW5pemF0aW9uc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShvcmdhbml6YXRpb25zTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25FdmVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEob3JnYW5pemF0aW9uc0xhbWJkYSk7XG5cbiAgICAvLyBDb21wZXRpdGlvbnMgc2VydmljZSAtIEhhbmRsZXMgY29tcGV0aXRpb25zIGFuZCBwdWJsaWMgZXZlbnRzIGVuZHBvaW50c1xuICAgIGNvbnN0IGNvbXBldGl0aW9uc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NvbXBldGl0aW9uc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2NvbXBldGl0aW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbXBldGl0aW9ucyBzZXJ2aWNlIHdpdGggcHVibGljIGV2ZW50cyBlbmRwb2ludHMgLSB2MicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVWRU5UU19UQUJMRTogZXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fRVZFTlRTX1RBQkxFOiBvcmdhbml6YXRpb25FdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIE9SR0FOSVpBVElPTl9NRU1CRVJTX1RBQkxFOiBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9JTUFHRVNfQlVDS0VUOiBldmVudEltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBldmVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY29tcGV0aXRpb25zTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25FdmVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY29tcGV0aXRpb25zTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25NZW1iZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShjb21wZXRpdGlvbnNMYW1iZGEpOyAvLyBSZWFkLW9ubHkgZm9yIGF1dGhvcml6YXRpb25cbiAgICBldmVudEltYWdlc0J1Y2tldC5ncmFudFB1dChjb21wZXRpdGlvbnNMYW1iZGEpO1xuICAgIFxuICAgIC8vIEdyYW50IEV2ZW50QnJpZGdlIHBlcm1pc3Npb25zIGZvciBldmVudC1kcml2ZW4gY29tbXVuaWNhdGlvblxuICAgIGNvbXBldGl0aW9uc0xhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIEV2ZW50IERheXMgc2VydmljZVxuICAgIGNvbnN0IGV2ZW50c0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0V2ZW50c0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2V2ZW50cy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVWRU5UX0RBWVNfVEFCTEU6IGV2ZW50RGF5c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRVZFTlRfSU1BR0VTX0JVQ0tFVDogZXZlbnRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgZXZlbnREYXlzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGV2ZW50c0xhbWJkYSk7XG4gICAgZXZlbnRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZXZlbnRzTGFtYmRhKTtcblxuICAgIC8vIFNjb3JlcyBzZXJ2aWNlXG4gICAgY29uc3Qgc2NvcmVzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2NvcmVzTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnc2NvcmVzLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2NvcmVzIHNlcnZpY2Ugd2l0aCBxdWVyeSBwYXJhbWV0ZXIgc3VwcG9ydCAtIHYyJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgU0NPUkVTX1RBQkxFOiBzY29yZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFUSExFVEVTX1RBQkxFOiBhdGhsZXRlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2NvcmVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHNjb3Jlc0xhbWJkYSk7XG4gICAgYXRobGV0ZXNUYWJsZS5ncmFudFJlYWREYXRhKHNjb3Jlc0xhbWJkYSk7XG4gICAgc2NvcmVzTGFtYmRhLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gQ2F0ZWdvcmllcyBzZXJ2aWNlXG4gICAgY29uc3QgY2F0ZWdvcmllc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NhdGVnb3JpZXNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjYXRlZ29yaWVzLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2F0ZWdvcmllcyBzZXJ2aWNlIHdpdGggZml4ZWQgQ09SUyBhbmQgYXV0aCAtIHY0JyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgQ0FURUdPUklFU19UQUJMRTogY2F0ZWdvcmllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX0VWRU5UU19UQUJMRTogb3JnYW5pemF0aW9uRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjYXRlZ29yaWVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNhdGVnb3JpZXNMYW1iZGEpO1xuICAgIG9yZ2FuaXphdGlvbkV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoY2F0ZWdvcmllc0xhbWJkYSk7XG5cbiAgICAvLyBXT0RzIHNlcnZpY2VcbiAgICBjb25zdCB3b2RzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnV29kc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3dvZHMuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdXT0RzIHNlcnZpY2UgLSBEREQgY29tcGxpYW50IC0gdjMnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBXT0RTX1RBQkxFOiB3b2RzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHdvZHNMYW1iZGEpO1xuXG4gICAgLy8gVXNlcnMgc2VydmljZVxuICAgIGNvbnN0IHVzZXJzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXNlcnNMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICd1c2Vycy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxMCwgIC8vIFByZXZlbnQgcnVuYXdheSBjb3N0c1xuICAgICAgZGVzY3JpcHRpb246ICdVc2VycyBzZXJ2aWNlIHdpdGggYXRobGV0ZSBwcm9maWxlIHVwZGF0ZSBzdXBwb3J0IC0gdjInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBBVEhMRVRFU19UQUJMRTogYXRobGV0ZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFUSExFVEVfRVZFTlRTX1RBQkxFOiBhdGhsZXRlRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1c2Vyc0xhbWJkYSk7XG4gICAgYXRobGV0ZUV2ZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1c2Vyc0xhbWJkYSk7XG5cbiAgICAvLyBBbmFseXRpY3Mgc2VydmljZVxuICAgIGNvbnN0IGFuYWx5dGljc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FuYWx5dGljc0xhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2FuYWx5dGljcy5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiA1LFxuICAgICAgZGVzY3JpcHRpb246ICdBbmFseXRpY3Mgc2VydmljZSB3aXRoIG9yZ2FuaXphdGlvbiBmaWx0ZXJpbmcgLSB2MScsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVWRU5UU19UQUJMRTogZXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBVEhMRVRFU19UQUJMRTogYXRobGV0ZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFUSExFVEVfRVZFTlRTX1RBQkxFOiBhdGhsZXRlRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBDQVRFR09SSUVTX1RBQkxFOiBjYXRlZ29yaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBXT0RTX1RBQkxFOiB3b2RzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTQ09SRVNfVEFCTEU6IHNjb3Jlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgT1JHQU5JWkFUSU9OX0VWRU5UU19UQUJMRTogb3JnYW5pemF0aW9uRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBPUkdBTklaQVRJT05fTUVNQkVSU19UQUJMRTogb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgZXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuICAgIGF0aGxldGVzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuICAgIGF0aGxldGVFdmVudHNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG4gICAgY2F0ZWdvcmllc1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NMYW1iZGEpO1xuICAgIHNjb3Jlc1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcbiAgICBvcmdhbml6YXRpb25FdmVudHNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0xhbWJkYSk7XG4gICAgb3JnYW5pemF0aW9uTWVtYmVyc1RhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzTGFtYmRhKTtcblxuICAgIC8vIFNlc3Npb25zIHNlcnZpY2VcbiAgICBjb25zdCBzZXNzaW9uc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Nlc3Npb25zTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnc2Vzc2lvbnMuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMTAsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNFU1NJT05TX1RBQkxFOiBzZXNzaW9uc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2Vzc2lvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc2Vzc2lvbnNMYW1iZGEpO1xuXG4gICAgLy8gU3RlcCBGdW5jdGlvbnMgVGFzayBMYW1iZGEgRnVuY3Rpb25zXG4gICAgY29uc3QgZ2V0RXZlbnREYXRhTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0RXZlbnREYXRhTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0LWV2ZW50LWRhdGEuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBFVkVOVFNfVEFCTEU6IGV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRVZFTlRfREFZU19UQUJMRTogZXZlbnREYXlzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldEF0aGxldGVzRGF0YUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldEF0aGxldGVzRGF0YUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2dldC1hdGhsZXRlcy1kYXRhLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudixcbiAgICAgICAgQVRITEVURVNfVEFCTEU6IGF0aGxldGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBVEhMRVRFX0VWRU5UU19UQUJMRTogYXRobGV0ZUV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRDYXRlZ29yaWVzRGF0YUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldENhdGVnb3JpZXNEYXRhTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0LWNhdGVnb3JpZXMtZGF0YS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIENBVEVHT1JJRVNfVEFCTEU6IGNhdGVnb3JpZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0V29kc0RhdGFMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRXb2RzRGF0YUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2dldC13b2RzLWRhdGEuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBXT0RTX1RBQkxFOiB3b2RzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdlbmVyYXRlU2NoZWR1bGVMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZW5lcmF0ZVNjaGVkdWxlTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZ2VuZXJhdGUtc2NoZWR1bGUuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNDSEVEVUxFU19UQUJMRTogc2NoZWR1bGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zXG4gICAgZXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRFdmVudERhdGFMYW1iZGEpO1xuICAgIGV2ZW50RGF5c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0RXZlbnREYXRhTGFtYmRhKTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0QXRobGV0ZXNEYXRhTGFtYmRhKTtcbiAgICBhdGhsZXRlRXZlbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRBdGhsZXRlc0RhdGFMYW1iZGEpO1xuICAgIGNhdGVnb3JpZXNUYWJsZS5ncmFudFJlYWREYXRhKGdldENhdGVnb3JpZXNEYXRhTGFtYmRhKTtcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRXb2RzRGF0YUxhbWJkYSk7XG4gICAgc2NoZWR1bGVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdlbmVyYXRlU2NoZWR1bGVMYW1iZGEpO1xuXG4gICAgLy8gU3RlcCBGdW5jdGlvbnMgRXhwcmVzcyBXb3JrZmxvd1xuICAgIGNvbnN0IGdldEV2ZW50RGF0YVRhc2sgPSBuZXcgc3RlcGZ1bmN0aW9uc1Rhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnR2V0RXZlbnREYXRhVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZXRFdmVudERhdGFMYW1iZGEsXG4gICAgICByZXN1bHRQYXRoOiAnJC5ldmVudFJlc3VsdCdcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldEF0aGxldGVzRGF0YVRhc2sgPSBuZXcgc3RlcGZ1bmN0aW9uc1Rhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnR2V0QXRobGV0ZXNEYXRhVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZXRBdGhsZXRlc0RhdGFMYW1iZGEsXG4gICAgICByZXN1bHRQYXRoOiAnJC5hdGhsZXRlc1Jlc3VsdCdcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldENhdGVnb3JpZXNEYXRhVGFzayA9IG5ldyBzdGVwZnVuY3Rpb25zVGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdHZXRDYXRlZ29yaWVzRGF0YVRhc2snLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogZ2V0Q2F0ZWdvcmllc0RhdGFMYW1iZGEsXG4gICAgICByZXN1bHRQYXRoOiAnJC5jYXRlZ29yaWVzUmVzdWx0J1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0V29kc0RhdGFUYXNrID0gbmV3IHN0ZXBmdW5jdGlvbnNUYXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0dldFdvZHNEYXRhVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZXRXb2RzRGF0YUxhbWJkYSxcbiAgICAgIHJlc3VsdFBhdGg6ICckLndvZHNSZXN1bHQnXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZW5lcmF0ZVNjaGVkdWxlVGFzayA9IG5ldyBzdGVwZnVuY3Rpb25zVGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdHZW5lcmF0ZVNjaGVkdWxlVGFzaycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBnZW5lcmF0ZVNjaGVkdWxlTGFtYmRhLFxuICAgICAgcGF5bG9hZDogc3RlcGZ1bmN0aW9ucy5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICdldmVudElkLiQnOiAnJFswXS5ldmVudElkJyxcbiAgICAgICAgJ2NvbmZpZy4kJzogJyRbMF0uY29uZmlnJyxcbiAgICAgICAgJ2V2ZW50RGF0YS4kJzogJyRbMF0uZXZlbnRSZXN1bHQuUGF5bG9hZC5ldmVudERhdGEnLFxuICAgICAgICAnZGF5cy4kJzogJyRbMF0uZXZlbnRSZXN1bHQuUGF5bG9hZC5kYXlzJyxcbiAgICAgICAgJ2F0aGxldGVzLiQnOiAnJFsxXS5hdGhsZXRlc1Jlc3VsdC5QYXlsb2FkLmF0aGxldGVzJyxcbiAgICAgICAgJ2NhdGVnb3JpZXMuJCc6ICckWzJdLmNhdGVnb3JpZXNSZXN1bHQuUGF5bG9hZC5jYXRlZ29yaWVzJyxcbiAgICAgICAgJ3dvZHMuJCc6ICckWzNdLndvZHNSZXN1bHQuUGF5bG9hZC53b2RzJ1xuICAgICAgfSksXG4gICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJ1xuICAgIH0pO1xuXG4gICAgLy8gUGFyYWxsZWwgZGF0YSBjb2xsZWN0aW9uXG4gICAgY29uc3QgcGFyYWxsZWxEYXRhQ29sbGVjdGlvbiA9IG5ldyBzdGVwZnVuY3Rpb25zLlBhcmFsbGVsKHRoaXMsICdQYXJhbGxlbERhdGFDb2xsZWN0aW9uJylcbiAgICAgIC5icmFuY2goZ2V0RXZlbnREYXRhVGFzaylcbiAgICAgIC5icmFuY2goZ2V0QXRobGV0ZXNEYXRhVGFzaylcbiAgICAgIC5icmFuY2goZ2V0Q2F0ZWdvcmllc0RhdGFUYXNrKVxuICAgICAgLmJyYW5jaChnZXRXb2RzRGF0YVRhc2spO1xuXG4gICAgY29uc3Qgc2NoZWR1bGVyV29ya2Zsb3cgPSBwYXJhbGxlbERhdGFDb2xsZWN0aW9uLm5leHQoZ2VuZXJhdGVTY2hlZHVsZVRhc2spO1xuXG4gICAgLy8gRXhwcmVzcyBTdGF0ZSBNYWNoaW5lXG4gICAgY29uc3Qgc2NoZWR1bGVyU3RhdGVNYWNoaW5lID0gbmV3IHN0ZXBmdW5jdGlvbnMuU3RhdGVNYWNoaW5lKHRoaXMsICdTY2hlZHVsZXJTdGF0ZU1hY2hpbmUnLCB7XG4gICAgICBkZWZpbml0aW9uQm9keTogc3RlcGZ1bmN0aW9ucy5EZWZpbml0aW9uQm9keS5mcm9tQ2hhaW5hYmxlKHNjaGVkdWxlcldvcmtmbG93KSxcbiAgICAgIHN0YXRlTWFjaGluZVR5cGU6IHN0ZXBmdW5jdGlvbnMuU3RhdGVNYWNoaW5lVHlwZS5FWFBSRVNTLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMilcbiAgICB9KTtcblxuICAgIC8vIERERC1Db21wbGlhbnQgU2NoZWR1bGVyIExhbWJkYVxuICAgIGNvbnN0IHNjaGVkdWxlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1NjaGVkdWxlckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3NjaGVkdWxlci1kZGQuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdEREQtY29tcGxpYW50IENvbXBldGl0aW9uIFNjaGVkdWxlciBTZXJ2aWNlIC0gdjYuMCcsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFNDSEVEVUxFU19UQUJMRTogc2NoZWR1bGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICAvLyBFdmVudEJyaWRnZSBmb3IgZG9tYWluIGV2ZW50c1xuICAgICAgICBFVkVOVF9CVVNfTkFNRTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBvd25lZCB0YWJsZSAoU2NoZWR1bGUgYm91bmRlZCBjb250ZXh0KVxuICAgIHNjaGVkdWxlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzY2hlZHVsZXJMYW1iZGEpO1xuICAgIFxuICAgIC8vIEdyYW50IHJlYWQtb25seSBhY2Nlc3MgdG8gZXh0ZXJuYWwgYm91bmRlZCBjb250ZXh0c1xuICAgIGV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoc2NoZWR1bGVyTGFtYmRhKTtcbiAgICBldmVudERheXNUYWJsZS5ncmFudFJlYWREYXRhKHNjaGVkdWxlckxhbWJkYSk7XG4gICAgY2F0ZWdvcmllc1RhYmxlLmdyYW50UmVhZERhdGEoc2NoZWR1bGVyTGFtYmRhKTtcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkRGF0YShzY2hlZHVsZXJMYW1iZGEpO1xuICAgIGF0aGxldGVFdmVudHNUYWJsZS5ncmFudFJlYWREYXRhKHNjaGVkdWxlckxhbWJkYSk7XG4gICAgYXRobGV0ZXNUYWJsZS5ncmFudFJlYWREYXRhKHNjaGVkdWxlckxhbWJkYSk7XG4gICAgXG4gICAgLy8gR3JhbnQgRXZlbnRCcmlkZ2UgcGVybWlzc2lvbnMgZm9yIGRvbWFpbiBldmVudHNcbiAgICBzY2hlZHVsZXJMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6ZXZlbnRzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpldmVudC1idXMvZGVmYXVsdGBdXG4gICAgfSkpO1xuXG4gICAgLy8gUHVibGljIFNjaGVkdWxlcyBMYW1iZGEgZm9yIGF0aGxldGUgYWNjZXNzICh1c2VzIERERCBzY2hlZHVsZXIgZm9yIHB1Ymxpc2hlZCBzY2hlZHVsZXMpXG4gICAgY29uc3QgcHVibGljU2NoZWR1bGVzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHVibGljU2NoZWR1bGVzTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAncHVibGljLXNjaGVkdWxlcy1kZGQuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaWMgc2NoZWR1bGVzIHNlcnZpY2UgZm9yIGF0aGxldGUgYWNjZXNzIC0gREREIHYyLjAnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBTQ0hFRFVMRVNfVEFCTEU6IHNjaGVkdWxlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgc2NoZWR1bGVzVGFibGUuZ3JhbnRSZWFkRGF0YShwdWJsaWNTY2hlZHVsZXNMYW1iZGEpO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2UgaGFuZGxlcnMgZm9yIGFsbCBkb21haW5zXG4gICAgY29uc3QgZXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZXZlbnRzLWV2ZW50YnJpZGdlLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdFdmVudHMgZG9tYWluIEV2ZW50QnJpZGdlIGhhbmRsZXIgLSB2MicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIEVWRU5UU19UQUJMRTogZXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9EQVlTX1RBQkxFOiBldmVudERheXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVWRU5UX0JVU19OQU1FOiAnZGVmYXVsdCcsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIGV2ZW50c1RhYmxlLmdyYW50UmVhZERhdGEoZXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyKTtcbiAgICBldmVudERheXNUYWJsZS5ncmFudFJlYWREYXRhKGV2ZW50c0V2ZW50QnJpZGdlSGFuZGxlcik7XG4gICAgZXZlbnRzRXZlbnRCcmlkZ2VIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICBjb25zdCBhdGhsZXRlc0V2ZW50QnJpZGdlSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0F0aGxldGVzRXZlbnRCcmlkZ2VIYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnYXRobGV0ZXMtZXZlbnRicmlkZ2UtaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0F0aGxldGVzIGRvbWFpbiBFdmVudEJyaWRnZSBoYW5kbGVyIC0gdjEnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBBVEhMRVRFU19UQUJMRTogYXRobGV0ZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFUSExFVEVfRVZFTlRTX1RBQkxFOiBhdGhsZXRlRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9CVVNfTkFNRTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZERhdGEoYXRobGV0ZXNFdmVudEJyaWRnZUhhbmRsZXIpO1xuICAgIGF0aGxldGVFdmVudHNUYWJsZS5ncmFudFJlYWREYXRhKGF0aGxldGVzRXZlbnRCcmlkZ2VIYW5kbGVyKTtcbiAgICBhdGhsZXRlc0V2ZW50QnJpZGdlSGFuZGxlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgY29uc3QgY2F0ZWdvcmllc0V2ZW50QnJpZGdlSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NhdGVnb3JpZXNFdmVudEJyaWRnZUhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdjYXRlZ29yaWVzLWV2ZW50YnJpZGdlLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZGVzY3JpcHRpb246ICdDYXRlZ29yaWVzIGRvbWFpbiBFdmVudEJyaWRnZSBoYW5kbGVyIC0gdjEnLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBDQVRFR09SSUVTX1RBQkxFOiBjYXRlZ29yaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBFVkVOVF9CVVNfTkFNRTogJ2RlZmF1bHQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBcbiAgICBjYXRlZ29yaWVzVGFibGUuZ3JhbnRSZWFkRGF0YShjYXRlZ29yaWVzRXZlbnRCcmlkZ2VIYW5kbGVyKTtcbiAgICBjYXRlZ29yaWVzRXZlbnRCcmlkZ2VIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICBjb25zdCB3b2RzRXZlbnRCcmlkZ2VIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnV29kc0V2ZW50QnJpZGdlSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3dvZHMtZXZlbnRicmlkZ2UtaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBkZXNjcmlwdGlvbjogJ1dPRHMgZG9tYWluIEV2ZW50QnJpZGdlIGhhbmRsZXIgLSB2MScsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFdPRFNfVEFCTEU6IHdvZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVWRU5UX0JVU19OQU1FOiAnZGVmYXVsdCcsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIHdvZHNUYWJsZS5ncmFudFJlYWREYXRhKHdvZHNFdmVudEJyaWRnZUhhbmRsZXIpO1xuICAgIHdvZHNFdmVudEJyaWRnZUhhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgIH0pKTtcblxuICAgIC8vIEV2ZW50QnJpZGdlIHJ1bGVzIGZvciBkb21haW4gZXZlbnQgaGFuZGxlcnNcbiAgICBjb25zdCBldmVudEJ1cyA9IGV2ZW50YnJpZGdlLkV2ZW50QnVzLmZyb21FdmVudEJ1c05hbWUodGhpcywgJ0RlZmF1bHRFdmVudEJ1cycsICdkZWZhdWx0Jyk7XG4gICAgXG4gICAgLy8gUnVsZXMgZm9yIGRhdGEgcmVxdWVzdHMgZnJvbSBzY2hlZHVsZXIgb3JjaGVzdHJhdG9yXG4gICAgbmV3IGV2ZW50YnJpZGdlLlJ1bGUodGhpcywgJ0V2ZW50RGF0YVJlcXVlc3RSdWxlJywge1xuICAgICAgZXZlbnRCdXMsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ3NjaGVkdWxlci5vcmNoZXN0cmF0b3InXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydFdmVudCBEYXRhIFJlcXVlc3RlZCddXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGV2ZW50c0V2ZW50QnJpZGdlSGFuZGxlcildXG4gICAgfSk7XG5cbiAgICBuZXcgZXZlbnRicmlkZ2UuUnVsZSh0aGlzLCAnQXRobGV0ZXNEYXRhUmVxdWVzdFJ1bGUnLCB7XG4gICAgICBldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnc2NoZWR1bGVyLm9yY2hlc3RyYXRvciddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0F0aGxldGVzIERhdGEgUmVxdWVzdGVkJ11cbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYXRobGV0ZXNFdmVudEJyaWRnZUhhbmRsZXIpXVxuICAgIH0pO1xuXG4gICAgbmV3IGV2ZW50YnJpZGdlLlJ1bGUodGhpcywgJ0NhdGVnb3JpZXNEYXRhUmVxdWVzdFJ1bGUnLCB7XG4gICAgICBldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnc2NoZWR1bGVyLm9yY2hlc3RyYXRvciddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0NhdGVnb3JpZXMgRGF0YSBSZXF1ZXN0ZWQnXVxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihjYXRlZ29yaWVzRXZlbnRCcmlkZ2VIYW5kbGVyKV1cbiAgICB9KTtcblxuICAgIG5ldyBldmVudGJyaWRnZS5SdWxlKHRoaXMsICdXb2RzRGF0YVJlcXVlc3RSdWxlJywge1xuICAgICAgZXZlbnRCdXMsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ3NjaGVkdWxlci5vcmNoZXN0cmF0b3InXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydXT0RzIERhdGEgUmVxdWVzdGVkJ11cbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24od29kc0V2ZW50QnJpZGdlSGFuZGxlcildXG4gICAgfSk7XG5cbiAgICAvLyBSdWxlcyBmb3IgZG9tYWluIHJlc3BvbnNlcyBiYWNrIHRvIHNjaGVkdWxlciBvcmNoZXN0cmF0b3JcbiAgICBuZXcgZXZlbnRicmlkZ2UuUnVsZSh0aGlzLCAnRG9tYWluUmVzcG9uc2VzUnVsZScsIHtcbiAgICAgIGV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydldmVudHMuZG9tYWluJywgJ2F0aGxldGVzLmRvbWFpbicsICdjYXRlZ29yaWVzLmRvbWFpbicsICd3b2RzLmRvbWFpbiddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0V2ZW50IERhdGEgUmVzcG9uc2UnLCAnQXRobGV0ZXMgRGF0YSBSZXNwb25zZScsICdDYXRlZ29yaWVzIERhdGEgUmVzcG9uc2UnLCAnV09EcyBEYXRhIFJlc3BvbnNlJ11cbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oc2NoZWR1bGVyTGFtYmRhKV1cbiAgICB9KTtcblxuICAgIC8vIEV2ZW50QnJpZGdlIGZvciBkZWNvdXBsZWQgbGVhZGVyYm9hcmQgY2FsY3VsYXRpb25zXG4gICAgY29uc3QgbGVhZGVyYm9hcmRDYWxjdWxhdG9yID0gbmV3IEV2ZW50YnJpZGdlVG9MYW1iZGEodGhpcywgJ0xlYWRlcmJvYXJkQ2FsY3VsYXRvcicsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uUHJvcHM6IHtcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICAgIGhhbmRsZXI6ICdsZWFkZXJib2FyZC1jYWxjdWxhdG9yLmhhbmRsZXInLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIFNDT1JFU19UQUJMRTogc2NvcmVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIEFUSExFVEVTX1RBQkxFOiBhdGhsZXRlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgICBFVkVOVFNfVEFCTEU6IGV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBldmVudFJ1bGVQcm9wczoge1xuICAgICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgICBzb3VyY2U6IFsnY2FsaXN0aGVuaWNzLnNjb3JlcyddLFxuICAgICAgICAgIGRldGFpbFR5cGU6IFsnU2NvcmUgVXBkYXRlZCcsICdTY29yZSBDcmVhdGVkJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNjb3Jlc1RhYmxlLmdyYW50UmVhZERhdGEobGVhZGVyYm9hcmRDYWxjdWxhdG9yLmxhbWJkYUZ1bmN0aW9uKTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZERhdGEobGVhZGVyYm9hcmRDYWxjdWxhdG9yLmxhbWJkYUZ1bmN0aW9uKTtcbiAgICBldmVudHNUYWJsZS5ncmFudFJlYWREYXRhKGxlYWRlcmJvYXJkQ2FsY3VsYXRvci5sYW1iZGFGdW5jdGlvbik7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSB3aXRoIG1pY3Jvc2VydmljZXMgcm91dGluZ1xuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0NhbGlzdGhlbmljc0FwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnQ2FsaXN0aGVuaWNzIENvbXBldGl0aW9uIEFQSScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHRocm90dGxpbmdCdXJzdExpbWl0OiAxMDAsICAvLyBNYXggY29uY3VycmVudCByZXF1ZXN0c1xuICAgICAgICB0aHJvdHRsaW5nUmF0ZUxpbWl0OiA1MCwgICAgLy8gUmVxdWVzdHMgcGVyIHNlY29uZFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvZ25pdG9BdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgJ0NvZ25pdG9BdXRob3JpemVyJywge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbiAgICB9KTtcblxuICAgIC8vIFB1YmxpYyBlbmRwb2ludCBmb3IgcHVibGlzaGVkIGV2ZW50cyAtIC9wdWJsaWMvZXZlbnRzIChubyBhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IHB1YmxpY1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3B1YmxpYycpO1xuICAgIGNvbnN0IHB1YmxpY0V2ZW50cyA9IHB1YmxpY1Jlc291cmNlLmFkZFJlc291cmNlKCdldmVudHMnKTtcbiAgICBwdWJsaWNFdmVudHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjb21wZXRpdGlvbnNMYW1iZGEpKTtcbiAgICBjb25zdCBwdWJsaWNFdmVudHNQcm94eSA9IHB1YmxpY0V2ZW50cy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBwdWJsaWNFdmVudHNQcm94eS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNvbXBldGl0aW9uc0xhbWJkYSkpO1xuXG4gICAgLy8gUHVibGljIGVuZHBvaW50IGZvciBwdWJsaXNoZWQgc2NoZWR1bGVzIC0gL3B1YmxpYy9zY2hlZHVsZXMgKG5vIGF1dGggcmVxdWlyZWQpXG4gICAgY29uc3QgcHVibGljU2NoZWR1bGVzID0gcHVibGljUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3NjaGVkdWxlcycpO1xuICAgIHB1YmxpY1NjaGVkdWxlcy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHB1YmxpY1NjaGVkdWxlc0xhbWJkYSkpO1xuICAgIGNvbnN0IHB1YmxpY1NjaGVkdWxlc1Byb3h5ID0gcHVibGljU2NoZWR1bGVzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHB1YmxpY1NjaGVkdWxlc1Byb3h5LmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHVibGljU2NoZWR1bGVzTGFtYmRhKSk7XG5cbiAgICAvLyBDb21wZXRpdGlvbnMgbWljcm9zZXJ2aWNlIC0gL2NvbXBldGl0aW9ucy8qIChhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IGNvbXBldGl0aW9ucyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdjb21wZXRpdGlvbnMnKTtcbiAgICBjb21wZXRpdGlvbnMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjb21wZXRpdGlvbnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IGNvbXBldGl0aW9uc1Byb3h5ID0gY29tcGV0aXRpb25zLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIGNvbXBldGl0aW9uc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY29tcGV0aXRpb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIE9yZ2FuaXphdGlvbnMgbWljcm9zZXJ2aWNlIC0gL29yZ2FuaXphdGlvbnMvKlxuICAgIGNvbnN0IG9yZ2FuaXphdGlvbnMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnb3JnYW5pemF0aW9ucycpO1xuICAgIG9yZ2FuaXphdGlvbnMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvcmdhbml6YXRpb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBvcmdhbml6YXRpb25zUHJveHkgPSBvcmdhbml6YXRpb25zLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIG9yZ2FuaXphdGlvbnNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG9yZ2FuaXphdGlvbnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gRXZlbnRzIG1pY3Jvc2VydmljZSAtIC9ldmVudHMvKlxuICAgIGNvbnN0IGV2ZW50cyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdldmVudHMnKTtcbiAgICBldmVudHMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihldmVudHNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IGV2ZW50c1Byb3h5ID0gZXZlbnRzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIGV2ZW50c1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZXZlbnRzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIFNjb3JlcyBtaWNyb3NlcnZpY2UgLSAvc2NvcmVzLypcbiAgICBjb25zdCBzY29yZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnc2NvcmVzJyk7XG4gICAgc2NvcmVzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2NvcmVzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBzY29yZXNQcm94eSA9IHNjb3Jlcy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBzY29yZXNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNjb3Jlc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBDYXRlZ29yaWVzIG1pY3Jvc2VydmljZSAtIC9jYXRlZ29yaWVzLypcbiAgICBjb25zdCBjYXRlZ29yaWVzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2NhdGVnb3JpZXMnKTtcbiAgICBjYXRlZ29yaWVzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY2F0ZWdvcmllc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgY2F0ZWdvcmllc1Byb3h5ID0gY2F0ZWdvcmllcy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICBjYXRlZ29yaWVzUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjYXRlZ29yaWVzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIFdPRHMgbWljcm9zZXJ2aWNlIC0gL3dvZHMvKlxuICAgIGNvbnN0IHdvZHMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnd29kcycpO1xuICAgIHdvZHMuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih3b2RzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCB3b2RzUHJveHkgPSB3b2RzLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHdvZHNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHdvZHNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gVXNlcnMgbWljcm9zZXJ2aWNlIC0gL21lLyogYW5kIC91c2Vycy8qIGFuZCAvYXRobGV0ZXMvKlxuICAgIGNvbnN0IG1lID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ21lJyk7XG4gICAgbWUuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgY29uc3QgbWVQcm94eSA9IG1lLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIG1lUHJveHkuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0xhbWJkYSksIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCB1c2VycyA9IGFwaS5yb290LmFkZFJlc291cmNlKCd1c2VycycpO1xuICAgIHVzZXJzLmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IHVzZXJzUHJveHkgPSB1c2Vycy5hZGRSZXNvdXJjZSgne3Byb3h5K30nKTtcbiAgICB1c2Vyc1Byb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gTGVnYWN5IC9hdGhsZXRlcyByb3V0ZSAobWFwcyB0byB1c2VycyBMYW1iZGEpXG4gICAgY29uc3QgYXRobGV0ZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYXRobGV0ZXMnKTtcbiAgICBhdGhsZXRlcy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBhdGhsZXRlc1Byb3h5ID0gYXRobGV0ZXMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgYXRobGV0ZXNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIFNlc3Npb25zIG1pY3Jvc2VydmljZSAtIC9zZXNzaW9ucy8qXG4gICAgY29uc3Qgc2Vzc2lvbnMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnc2Vzc2lvbnMnKTtcbiAgICBzZXNzaW9ucy5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICBjb25zdCBzZXNzaW9uc1Byb3h5ID0gc2Vzc2lvbnMuYWRkUmVzb3VyY2UoJ3twcm94eSt9Jyk7XG4gICAgc2Vzc2lvbnNQcm94eS5hZGRNZXRob2QoJ0FOWScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIFNjaGVkdWxlciBtaWNyb3NlcnZpY2UgLSAvc2NoZWR1bGVyLyogKGludGVncmF0ZWQgd2l0aCBjb21wZXRpdGlvbnMpXG4gICAgLy8gTm90ZTogU2NoZWR1bGVyIHJvdXRlcyBhcmUgaGFuZGxlZCB3aXRoaW4gY29tcGV0aXRpb25zIExhbWJkYSBmb3IgL2NvbXBldGl0aW9ucy97ZXZlbnRJZH0vc2NoZWR1bGVcbiAgICAvLyBUaGlzIHByb3ZpZGVzIGEgZGVkaWNhdGVkIHNjaGVkdWxlciBlbmRwb2ludCBmb3IgYWR2YW5jZWQgb3BlcmF0aW9uc1xuICAgIGNvbnN0IHNjaGVkdWxlciA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzY2hlZHVsZXInKTtcbiAgICBzY2hlZHVsZXIuYWRkTWV0aG9kKCdBTlknLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzY2hlZHVsZXJMYW1iZGEpLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNvbnN0IHNjaGVkdWxlclByb3h5ID0gc2NoZWR1bGVyLmFkZFJlc291cmNlKCd7cHJveHkrfScpO1xuICAgIHNjaGVkdWxlclByb3h5LmFkZE1ldGhvZCgnQU5ZJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2NoZWR1bGVyTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIEFuYWx5dGljcyBtaWNyb3NlcnZpY2UgLSAvYW5hbHl0aWNzLypcbiAgICBjb25zdCBhbmFseXRpY3MgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XG4gICAgYW5hbHl0aWNzLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYW5hbHl0aWNzTGFtYmRhKSwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHsgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7IHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7IHZhbHVlOiBhcGkudXJsIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJzaXRlVXJsJywgeyB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0V2ZW50SW1hZ2VzQnVja2V0TmFtZScsIHsgdmFsdWU6IGV2ZW50SW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHsgdmFsdWU6IHdlYnNpdGVCdWNrZXQuYnVja2V0TmFtZSB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uSWQnLCB7IHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQgfSk7XG4gICAgXG4gICAgLy8gREREIFNjaGVkdWxlciBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RERFNjaGVkdWxlckxhbWJkYUFybicsIHtcbiAgICAgIHZhbHVlOiBzY2hlZHVsZXJMYW1iZGEuZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0RERC1jb21wbGlhbnQgU2NoZWR1bGVyIExhbWJkYSBBUk4nXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NjaGVkdWxlckVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IGAke2FwaS51cmx9c2NoZWR1bGVyL2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RERCBTY2hlZHVsZXIgQVBJIGVuZHBvaW50J1xuICAgIH0pO1xuICAgIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZENvbmZpZycsIHtcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFwaVVybDogYXBpLnVybCxcbiAgICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgdXNlclBvb2xDbGllbnRJZDogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIH0pLFxuICAgIH0pO1xuICB9XG59XG4iXX0=