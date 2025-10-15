import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
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
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
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
    const leaderboardCalculator = new EventbridgeToLambda(this, 'LeaderboardCalculator', {
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
