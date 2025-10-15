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
const iam = require("aws-cdk-lib/aws-iam");
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
                role: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: true }),
                division: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: true }),
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
        // DynamoDB Tables - Using On-Demand billing for cost optimization
        // On-Demand is ideal for unpredictable competition traffic patterns
        const eventsTable = new dynamodb.Table(this, 'EventsTable', {
            tableName: 'calisthenics-events',
            partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Cost-optimized: Pay only for actual usage
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const scoresTable = new dynamodb.Table(this, 'ScoresTable', {
            tableName: 'calisthenics-scores',
            partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'athleteId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Cost-optimized: Handles traffic spikes efficiently
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const athletesTable = new dynamodb.Table(this, 'AthletesTable', {
            tableName: 'calisthenics-athletes',
            partitionKey: { name: 'athleteId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Cost-optimized: No unused capacity charges
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const categoriesTable = new dynamodb.Table(this, 'CategoriesTable', {
            tableName: 'calisthenics-categories',
            partitionKey: { name: 'categoryId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Cost-optimized: Low-frequency access pattern
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const wodsTable = new dynamodb.Table(this, 'WodsTable', {
            tableName: 'calisthenics-wods',
            partitionKey: { name: 'wodId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Cost-optimized: Event-driven usage
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
                origin: new origins.S3Origin(websiteBucket),
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
        // Add OAC to the distribution
        const cfnDistribution = distribution.node.defaultChild;
        cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');
        cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', originAccessControl.attrId);
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
        // Lambda Functions
        const apiLambda = new lambda.Function(this, 'ApiLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda'),
            memorySize: 256, // Optimized: 256MB is sufficient for CRUD operations with DynamoDB
            timeout: cdk.Duration.seconds(30), // Explicit timeout for cost control
            environment: {
                EVENTS_TABLE: eventsTable.tableName,
                SCORES_TABLE: scoresTable.tableName,
                ATHLETES_TABLE: athletesTable.tableName,
                CATEGORIES_TABLE: categoriesTable.tableName,
                WODS_TABLE: wodsTable.tableName,
                USER_POOL_ID: userPool.userPoolId,
                EVENT_IMAGES_BUCKET: eventImagesBucket.bucketName,
            },
        });
        // Grant permissions
        eventsTable.grantReadWriteData(apiLambda);
        scoresTable.grantReadWriteData(apiLambda);
        athletesTable.grantReadWriteData(apiLambda);
        categoriesTable.grantReadWriteData(apiLambda);
        wodsTable.grantReadWriteData(apiLambda);
        eventImagesBucket.grantReadWrite(apiLambda);
        // EventBridge for decoupled leaderboard calculations
        const leaderboardCalculator = new aws_eventbridge_lambda_1.EventbridgeToLambda(this, 'LeaderboardCalculator', {
            lambdaFunctionProps: {
                runtime: lambda.Runtime.NODEJS_18_X,
                handler: 'leaderboard-calculator.handler',
                code: lambda.Code.fromAsset('lambda'),
                memorySize: 512, // Higher memory for leaderboard calculations
                timeout: cdk.Duration.minutes(5), // Longer timeout for complex calculations
                environment: {
                    SCORES_TABLE: scoresTable.tableName,
                    ATHLETES_TABLE: athletesTable.tableName,
                },
            },
            eventRuleProps: {
                eventPattern: {
                    source: ['calisthenics.scores'],
                    detailType: ['Score Updated', 'Score Created'],
                },
            },
        });
        // Grant leaderboard calculator access to tables
        scoresTable.grantReadData(leaderboardCalculator.lambdaFunction);
        athletesTable.grantReadData(leaderboardCalculator.lambdaFunction);
        // Add EventBridge permissions to main API Lambda
        apiLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: ['*'], // EventBridge default bus
        }));
        // API Gateway
        const api = new apigateway.RestApi(this, 'CalisthenicsApi', {
            restApiName: 'Calisthenics Competition API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
        });
        const integration = new apigateway.LambdaIntegration(apiLambda);
        // API Routes
        const events = api.root.addResource('events');
        events.addMethod('GET', integration);
        events.addMethod('POST', integration, { authorizer: cognitoAuthorizer });
        const eventById = events.addResource('{eventId}');
        eventById.addMethod('GET', integration);
        eventById.addMethod('PUT', integration, { authorizer: cognitoAuthorizer });
        eventById.addMethod('DELETE', integration, { authorizer: cognitoAuthorizer });
        const uploadImage = eventById.addResource('upload-image');
        uploadImage.addMethod('POST', integration, { authorizer: cognitoAuthorizer });
        const scores = api.root.addResource('scores');
        scores.addMethod('GET', integration);
        scores.addMethod('POST', integration, { authorizer: cognitoAuthorizer }); // Should be admin-only
        // Add route for updating scores: /scores/{eventId}/{athleteId}
        const scoreByEventAndAthlete = scores.addResource('{eventId}').addResource('{athleteId}');
        scoreByEventAndAthlete.addMethod('PUT', integration, { authorizer: cognitoAuthorizer });
        const leaderboard = scores.addResource('leaderboard');
        leaderboard.addMethod('GET', integration);
        const athletes = api.root.addResource('athletes');
        athletes.addMethod('GET', integration, { authorizer: cognitoAuthorizer });
        athletes.addMethod('POST', integration, { authorizer: cognitoAuthorizer });
        const athleteById = athletes.addResource('{athleteId}');
        athleteById.addMethod('PUT', integration, { authorizer: cognitoAuthorizer });
        athleteById.addMethod('DELETE', integration, { authorizer: cognitoAuthorizer });
        // Categories endpoints
        const categories = api.root.addResource('categories');
        categories.addMethod('GET', integration);
        categories.addMethod('POST', integration, { authorizer: cognitoAuthorizer });
        const categoryById = categories.addResource('{categoryId}');
        categoryById.addMethod('PUT', integration, { authorizer: cognitoAuthorizer });
        categoryById.addMethod('DELETE', integration, { authorizer: cognitoAuthorizer });
        // WODs endpoints
        const wods = api.root.addResource('wods');
        wods.addMethod('GET', integration);
        wods.addMethod('POST', integration, { authorizer: cognitoAuthorizer });
        const wodById = wods.addResource('{wodId}');
        wodById.addMethod('PUT', integration, { authorizer: cognitoAuthorizer });
        wodById.addMethod('DELETE', integration, { authorizer: cognitoAuthorizer });
        // Outputs
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
        new cdk.CfnOutput(this, 'WebsiteUrl', { value: distribution.distributionDomainName });
        new cdk.CfnOutput(this, 'EventImagesBucketName', { value: eventImagesBucket.bucketName });
    }
}
exports.CalisthenicsAppStack = CalisthenicsAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsaXN0aGVuaWNzLWFwcC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNhbGlzdGhlbmljcy1hcHAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLG1EQUFtRDtBQUNuRCxxREFBcUQ7QUFDckQsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCx5Q0FBeUM7QUFDekMseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCwyQ0FBMkM7QUFFM0MsNkZBQXVGO0FBR3ZGLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDakQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix1Q0FBdUM7UUFDdkMsTUFBTSxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUNsRSxZQUFZLEVBQUUsb0JBQW9CO1lBQ2xDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUM5QixrQkFBa0IsRUFBRTtnQkFDbEIsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2dCQUN4QyxTQUFTLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7Z0JBQzVDLFVBQVUsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTthQUM5QztZQUNELGdCQUFnQixFQUFFO2dCQUNoQixJQUFJLEVBQUUsSUFBSSxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztnQkFDM0Us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QUFDLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRXZFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDNUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUFFLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUN6RSxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBRTVFLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUN0RSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLGNBQWMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7UUFDeEYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdEQsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxDQUFDLHNCQUFzQixFQUFFLENBQUMsQ0FBQztRQUN0RixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDNUYsQ0FBQztDQUNGO0FBcFJELG9EQW9SQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgeyBFdmVudGJyaWRnZVRvTGFtYmRhIH0gZnJvbSAnQGF3cy1zb2x1dGlvbnMtY29uc3RydWN0cy9hd3MtZXZlbnRicmlkZ2UtbGFtYmRhJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgQ2FsaXN0aGVuaWNzQXBwU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCBmb3IgYXV0aGVudGljYXRpb25cbiAgICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdDYWxpc3RoZW5pY3NVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2NhbGlzdGhlbmljcy11c2VycycsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgICBnaXZlbk5hbWU6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcbiAgICAgICAgZmFtaWx5TmFtZTogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgcm9sZTogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbWluTGVuOiAxLCBtYXhMZW46IDIwLCBtdXRhYmxlOiB0cnVlIH0pLFxuICAgICAgICBkaXZpc2lvbjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbWluTGVuOiAxLCBtYXhMZW46IDUwLCBtdXRhYmxlOiB0cnVlIH0pLFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdDYWxpc3RoZW5pY3NVc2VyUG9vbENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sLFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXMgLSBVc2luZyBPbi1EZW1hbmQgYmlsbGluZyBmb3IgY29zdCBvcHRpbWl6YXRpb25cbiAgICAvLyBPbi1EZW1hbmQgaXMgaWRlYWwgZm9yIHVucHJlZGljdGFibGUgY29tcGV0aXRpb24gdHJhZmZpYyBwYXR0ZXJuc1xuICAgIGNvbnN0IGV2ZW50c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdFdmVudHNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2NhbGlzdGhlbmljcy1ldmVudHMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdldmVudElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsIC8vIENvc3Qtb3B0aW1pemVkOiBQYXkgb25seSBmb3IgYWN0dWFsIHVzYWdlXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2NvcmVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Njb3Jlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnY2FsaXN0aGVuaWNzLXNjb3JlcycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnYXRobGV0ZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsIC8vIENvc3Qtb3B0aW1pemVkOiBIYW5kbGVzIHRyYWZmaWMgc3Bpa2VzIGVmZmljaWVudGx5XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXRobGV0ZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXRobGV0ZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2NhbGlzdGhlbmljcy1hdGhsZXRlcycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2F0aGxldGVJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULCAvLyBDb3N0LW9wdGltaXplZDogTm8gdW51c2VkIGNhcGFjaXR5IGNoYXJnZXNcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBjb25zdCBjYXRlZ29yaWVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0NhdGVnb3JpZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2NhbGlzdGhlbmljcy1jYXRlZ29yaWVzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY2F0ZWdvcnlJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULCAvLyBDb3N0LW9wdGltaXplZDogTG93LWZyZXF1ZW5jeSBhY2Nlc3MgcGF0dGVyblxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdvZHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnV29kc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnY2FsaXN0aGVuaWNzLXdvZHMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd3b2RJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULCAvLyBDb3N0LW9wdGltaXplZDogRXZlbnQtZHJpdmVuIHVzYWdlXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gUzMgQnVja2V0IGZvciBmcm9udGVuZCBob3N0aW5nXG4gICAgY29uc3Qgd2Vic2l0ZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1dlYnNpdGVCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgY2FsaXN0aGVuaWNzLWFwcC0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICB9KTtcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgZXZlbnQgaW1hZ2VzXG4gICAgY29uc3QgZXZlbnRJbWFnZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdFdmVudEltYWdlc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBjYWxpc3RoZW5pY3MtZXZlbnQtaW1hZ2VzLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NUXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IHRydWUsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUNMUyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBDb250cm9sIChPQUMpIC0gbGF0ZXN0IENESyBzeW50YXhcbiAgICBjb25zdCBvcmlnaW5BY2Nlc3NDb250cm9sID0gbmV3IGNsb3VkZnJvbnQuQ2ZuT3JpZ2luQWNjZXNzQ29udHJvbCh0aGlzLCAnT0FDJywge1xuICAgICAgb3JpZ2luQWNjZXNzQ29udHJvbENvbmZpZzoge1xuICAgICAgICBuYW1lOiAnY2FsaXN0aGVuaWNzLWFwcC1vYWMnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ09BQyBmb3IgQ2FsaXN0aGVuaWNzIEFwcCcsXG4gICAgICAgIG9yaWdpbkFjY2Vzc0NvbnRyb2xPcmlnaW5UeXBlOiAnczMnLFxuICAgICAgICBzaWduaW5nQmVoYXZpb3I6ICdhbHdheXMnLFxuICAgICAgICBzaWduaW5nUHJvdG9jb2w6ICdzaWd2NCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBEaXN0cmlidXRpb25cbiAgICBjb25zdCBkaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHdlYnNpdGVCdWNrZXQpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIE9BQyB0byB0aGUgZGlzdHJpYnV0aW9uXG4gICAgY29uc3QgY2ZuRGlzdHJpYnV0aW9uID0gZGlzdHJpYnV0aW9uLm5vZGUuZGVmYXVsdENoaWxkIGFzIGNsb3VkZnJvbnQuQ2ZuRGlzdHJpYnV0aW9uO1xuICAgIGNmbkRpc3RyaWJ1dGlvbi5hZGRQcm9wZXJ0eU92ZXJyaWRlKCdEaXN0cmlidXRpb25Db25maWcuT3JpZ2lucy4wLlMzT3JpZ2luQ29uZmlnLk9yaWdpbkFjY2Vzc0lkZW50aXR5JywgJycpO1xuICAgIGNmbkRpc3RyaWJ1dGlvbi5hZGRQcm9wZXJ0eU92ZXJyaWRlKCdEaXN0cmlidXRpb25Db25maWcuT3JpZ2lucy4wLk9yaWdpbkFjY2Vzc0NvbnRyb2xJZCcsIG9yaWdpbkFjY2Vzc0NvbnRyb2wuYXR0cklkKTtcblxuICAgIC8vIEdyYW50IENsb3VkRnJvbnQgYWNjZXNzIHRvIFMzIGJ1Y2tldCB2aWEgYnVja2V0IHBvbGljeVxuICAgIHdlYnNpdGVCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgcmVzb3VyY2VzOiBbd2Vic2l0ZUJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyldLFxuICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY2xvdWRmcm9udC5hbWF6b25hd3MuY29tJyldLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnQVdTOlNvdXJjZUFybic6IGBhcm46YXdzOmNsb3VkZnJvbnQ6OiR7dGhpcy5hY2NvdW50fTpkaXN0cmlidXRpb24vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWR9YCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSkpO1xuXG4gICAgLy8gTGFtYmRhIEZ1bmN0aW9uc1xuICAgIGNvbnN0IGFwaUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NiwgLy8gT3B0aW1pemVkOiAyNTZNQiBpcyBzdWZmaWNpZW50IGZvciBDUlVEIG9wZXJhdGlvbnMgd2l0aCBEeW5hbW9EQlxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLCAvLyBFeHBsaWNpdCB0aW1lb3V0IGZvciBjb3N0IGNvbnRyb2xcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVWRU5UU19UQUJMRTogZXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTQ09SRVNfVEFCTEU6IHNjb3Jlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVRITEVURVNfVEFCTEU6IGF0aGxldGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBDQVRFR09SSUVTX1RBQkxFOiBjYXRlZ29yaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBXT0RTX1RBQkxFOiB3b2RzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIEVWRU5UX0lNQUdFU19CVUNLRVQ6IGV2ZW50SW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnNcbiAgICBldmVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpTGFtYmRhKTtcbiAgICBzY29yZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpTGFtYmRhKTtcbiAgICBhdGhsZXRlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlMYW1iZGEpO1xuICAgIGNhdGVnb3JpZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpTGFtYmRhKTtcbiAgICB3b2RzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaUxhbWJkYSk7XG4gICAgZXZlbnRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYXBpTGFtYmRhKTtcblxuICAgIC8vIEV2ZW50QnJpZGdlIGZvciBkZWNvdXBsZWQgbGVhZGVyYm9hcmQgY2FsY3VsYXRpb25zXG4gICAgY29uc3QgbGVhZGVyYm9hcmRDYWxjdWxhdG9yID0gbmV3IEV2ZW50YnJpZGdlVG9MYW1iZGEodGhpcywgJ0xlYWRlcmJvYXJkQ2FsY3VsYXRvcicsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uUHJvcHM6IHtcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICAgIGhhbmRsZXI6ICdsZWFkZXJib2FyZC1jYWxjdWxhdG9yLmhhbmRsZXInLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgICBtZW1vcnlTaXplOiA1MTIsIC8vIEhpZ2hlciBtZW1vcnkgZm9yIGxlYWRlcmJvYXJkIGNhbGN1bGF0aW9uc1xuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSwgLy8gTG9uZ2VyIHRpbWVvdXQgZm9yIGNvbXBsZXggY2FsY3VsYXRpb25zXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgU0NPUkVTX1RBQkxFOiBzY29yZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgICAgQVRITEVURVNfVEFCTEU6IGF0aGxldGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGV2ZW50UnVsZVByb3BzOiB7XG4gICAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICAgIHNvdXJjZTogWydjYWxpc3RoZW5pY3Muc2NvcmVzJ10sXG4gICAgICAgICAgZGV0YWlsVHlwZTogWydTY29yZSBVcGRhdGVkJywgJ1Njb3JlIENyZWF0ZWQnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBsZWFkZXJib2FyZCBjYWxjdWxhdG9yIGFjY2VzcyB0byB0YWJsZXNcbiAgICBzY29yZXNUYWJsZS5ncmFudFJlYWREYXRhKGxlYWRlcmJvYXJkQ2FsY3VsYXRvci5sYW1iZGFGdW5jdGlvbik7XG4gICAgYXRobGV0ZXNUYWJsZS5ncmFudFJlYWREYXRhKGxlYWRlcmJvYXJkQ2FsY3VsYXRvci5sYW1iZGFGdW5jdGlvbik7XG5cbiAgICAvLyBBZGQgRXZlbnRCcmlkZ2UgcGVybWlzc2lvbnMgdG8gbWFpbiBBUEkgTGFtYmRhXG4gICAgYXBpTGFtYmRhLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sIC8vIEV2ZW50QnJpZGdlIGRlZmF1bHQgYnVzXG4gICAgfSkpO1xuXG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdDYWxpc3RoZW5pY3NBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ0NhbGlzdGhlbmljcyBDb21wZXRpdGlvbiBBUEknLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCAnQ29nbml0b0F1dGhvcml6ZXInLCB7XG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbdXNlclBvb2xdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlMYW1iZGEpO1xuXG4gICAgLy8gQVBJIFJvdXRlc1xuICAgIGNvbnN0IGV2ZW50cyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdldmVudHMnKTtcbiAgICBldmVudHMuYWRkTWV0aG9kKCdHRVQnLCBpbnRlZ3JhdGlvbik7XG4gICAgZXZlbnRzLmFkZE1ldGhvZCgnUE9TVCcsIGludGVncmF0aW9uLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgY29uc3QgZXZlbnRCeUlkID0gZXZlbnRzLmFkZFJlc291cmNlKCd7ZXZlbnRJZH0nKTtcbiAgICBldmVudEJ5SWQuYWRkTWV0aG9kKCdHRVQnLCBpbnRlZ3JhdGlvbik7XG4gICAgZXZlbnRCeUlkLmFkZE1ldGhvZCgnUFVUJywgaW50ZWdyYXRpb24sIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG4gICAgZXZlbnRCeUlkLmFkZE1ldGhvZCgnREVMRVRFJywgaW50ZWdyYXRpb24sIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCB1cGxvYWRJbWFnZSA9IGV2ZW50QnlJZC5hZGRSZXNvdXJjZSgndXBsb2FkLWltYWdlJyk7XG4gICAgdXBsb2FkSW1hZ2UuYWRkTWV0aG9kKCdQT1NUJywgaW50ZWdyYXRpb24sIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCBzY29yZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnc2NvcmVzJyk7XG4gICAgc2NvcmVzLmFkZE1ldGhvZCgnR0VUJywgaW50ZWdyYXRpb24pO1xuICAgIHNjb3Jlcy5hZGRNZXRob2QoJ1BPU1QnLCBpbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTsgLy8gU2hvdWxkIGJlIGFkbWluLW9ubHlcblxuICAgIC8vIEFkZCByb3V0ZSBmb3IgdXBkYXRpbmcgc2NvcmVzOiAvc2NvcmVzL3tldmVudElkfS97YXRobGV0ZUlkfVxuICAgIGNvbnN0IHNjb3JlQnlFdmVudEFuZEF0aGxldGUgPSBzY29yZXMuYWRkUmVzb3VyY2UoJ3tldmVudElkfScpLmFkZFJlc291cmNlKCd7YXRobGV0ZUlkfScpO1xuICAgIHNjb3JlQnlFdmVudEFuZEF0aGxldGUuYWRkTWV0aG9kKCdQVVQnLCBpbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIGNvbnN0IGxlYWRlcmJvYXJkID0gc2NvcmVzLmFkZFJlc291cmNlKCdsZWFkZXJib2FyZCcpO1xuICAgIGxlYWRlcmJvYXJkLmFkZE1ldGhvZCgnR0VUJywgaW50ZWdyYXRpb24pO1xuXG4gICAgY29uc3QgYXRobGV0ZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYXRobGV0ZXMnKTtcbiAgICBhdGhsZXRlcy5hZGRNZXRob2QoJ0dFVCcsIGludGVncmF0aW9uLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGF0aGxldGVzLmFkZE1ldGhvZCgnUE9TVCcsIGludGVncmF0aW9uLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgY29uc3QgYXRobGV0ZUJ5SWQgPSBhdGhsZXRlcy5hZGRSZXNvdXJjZSgne2F0aGxldGVJZH0nKTtcbiAgICBhdGhsZXRlQnlJZC5hZGRNZXRob2QoJ1BVVCcsIGludGVncmF0aW9uLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGF0aGxldGVCeUlkLmFkZE1ldGhvZCgnREVMRVRFJywgaW50ZWdyYXRpb24sIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBDYXRlZ29yaWVzIGVuZHBvaW50c1xuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnY2F0ZWdvcmllcycpO1xuICAgIGNhdGVnb3JpZXMuYWRkTWV0aG9kKCdHRVQnLCBpbnRlZ3JhdGlvbik7XG4gICAgY2F0ZWdvcmllcy5hZGRNZXRob2QoJ1BPU1QnLCBpbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcblxuICAgIGNvbnN0IGNhdGVnb3J5QnlJZCA9IGNhdGVnb3JpZXMuYWRkUmVzb3VyY2UoJ3tjYXRlZ29yeUlkfScpO1xuICAgIGNhdGVnb3J5QnlJZC5hZGRNZXRob2QoJ1BVVCcsIGludGVncmF0aW9uLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuICAgIGNhdGVnb3J5QnlJZC5hZGRNZXRob2QoJ0RFTEVURScsIGludGVncmF0aW9uLCB7IGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyIH0pO1xuXG4gICAgLy8gV09EcyBlbmRwb2ludHNcbiAgICBjb25zdCB3b2RzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3dvZHMnKTtcbiAgICB3b2RzLmFkZE1ldGhvZCgnR0VUJywgaW50ZWdyYXRpb24pO1xuICAgIHdvZHMuYWRkTWV0aG9kKCdQT1NUJywgaW50ZWdyYXRpb24sIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCB3b2RCeUlkID0gd29kcy5hZGRSZXNvdXJjZSgne3dvZElkfScpO1xuICAgIHdvZEJ5SWQuYWRkTWV0aG9kKCdQVVQnLCBpbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplciB9KTtcbiAgICB3b2RCeUlkLmFkZE1ldGhvZCgnREVMRVRFJywgaW50ZWdyYXRpb24sIHsgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7IHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywgeyB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywgeyB2YWx1ZTogYXBpLnVybCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2Vic2l0ZVVybCcsIHsgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFdmVudEltYWdlc0J1Y2tldE5hbWUnLCB7IHZhbHVlOiBldmVudEltYWdlc0J1Y2tldC5idWNrZXROYW1lIH0pO1xuICB9XG59XG4iXX0=