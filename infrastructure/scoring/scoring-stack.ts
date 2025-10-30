import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface ScoringStackProps  {
  stage: string;  eventBus: events.EventBus;
}

export class ScoringStack extends Construct {
  public readonly scoresLambda: lambda.Function;
  public readonly exercisesLambda: lambda.Function;
  public readonly scoresTable: dynamodb.Table;
  public readonly scoringSystemsTable: dynamodb.Table;
  public readonly leaderboardCacheTable: dynamodb.Table;
  public readonly exerciseLibraryTable: dynamodb.Table;
  public readonly scoringEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: ScoringStackProps) {
    super(scope, id);

    // Domain-specific EventBridge Bus
    this.scoringEventBus = new events.EventBus(this, 'ScoringEventBus', {
      eventBusName: `scoring-domain-${props.stage}`,
    });

    // Scores Table
    this.scoresTable = new dynamodb.Table(this, 'ScoresTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scoreId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.scoresTable.addGlobalSecondaryIndex({
      indexName: 'athlete-scores-index',
      partitionKey: { name: 'athleteId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
    });

    // Scoring Systems Table
    this.scoringSystemsTable = new dynamodb.Table(this, 'ScoringSystemsTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scoringSystemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Leaderboard Cache Table
    this.leaderboardCacheTable = new dynamodb.Table(this, 'LeaderboardCacheTable', {
      partitionKey: { name: 'leaderboardId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.leaderboardCacheTable.addGlobalSecondaryIndex({
      indexName: 'event-leaderboards-index',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
    });

    // Exercise Library Table
    this.exerciseLibraryTable = new dynamodb.Table(this, 'ExerciseLibraryTable', {
      partitionKey: { name: 'exerciseId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Scores Lambda
    this.scoresLambda = new lambda.Function(this, 'ScoresLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        SCORES_TABLE: this.scoresTable.tableName,
        SCORING_SYSTEMS_TABLE: this.scoringSystemsTable.tableName,
        DOMAIN_EVENT_BUS: this.scoringEventBus.eventBusName,
        CENTRAL_EVENT_BUS: props.eventBus.eventBusName,
      },
    });

    this.scoresTable.grantReadWriteData(this.scoresLambda);
    this.scoringSystemsTable.grantReadData(this.scoresLambda);
    this.scoringEventBus.grantPutEventsTo(this.scoresLambda);
    props.eventBus.grantPutEventsTo(this.scoresLambda);

    // Leaderboard API Lambda
    const leaderboardLambda = new lambda.Function(this, 'LeaderboardLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'leaderboard-api.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        LEADERBOARD_TABLE: this.leaderboardCacheTable.tableName,
        SCORES_TABLE: this.scoresTable.tableName,
      },
    });

    this.leaderboardCacheTable.grantReadData(leaderboardLambda);
    this.scoresTable.grantReadData(leaderboardLambda);

    // Leaderboard Calculator Lambda
    const calculatorLambda = new lambda.Function(this, 'LeaderboardCalculator', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'leaderboard-calculator.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        SCORES_TABLE: this.scoresTable.tableName,
        LEADERBOARD_TABLE: this.leaderboardCacheTable.tableName,
      },
    });

    this.scoresTable.grantReadData(calculatorLambda);
    this.leaderboardCacheTable.grantReadWriteData(calculatorLambda);

    // EventBridge rule for leaderboard updates
    new events.Rule(this, 'ScoreCalculatedRule', {
      eventBus: this.scoringEventBus,
      eventPattern: {
        source: ['scoringames.scores'],
        detailType: ['ScoreCalculated'],
      },
      targets: [new targets.LambdaFunction(calculatorLambda)],
    });

    // Scoring Systems Lambda
    const scoringSystemsLambda = new lambda.Function(this, 'ScoringSystemsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'systems.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        SCORING_SYSTEMS_TABLE: this.scoringSystemsTable.tableName,
      },
    });

    this.scoringSystemsTable.grantReadWriteData(scoringSystemsLambda);

    // Exercise Library Lambda
    this.exercisesLambda = new lambda.Function(this, 'ExercisesLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'exercises.handler',
      code: lambda.Code.fromAsset('lambda/scoring'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        EXERCISE_LIBRARY_TABLE: this.exerciseLibraryTable.tableName,
      },
    });

    this.exerciseLibraryTable.grantReadWriteData(this.exercisesLambda);

    // Outputs
  }
}
