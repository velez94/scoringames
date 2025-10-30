import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface SchedulingStackProps  {
  stage: string;  eventBus: events.EventBus;
}

export class SchedulingStack extends Construct {
  public readonly schedulerLambda: lambda.Function;
  public readonly schedulesTable: dynamodb.Table;
  public readonly heatsTable: dynamodb.Table;
  public readonly classificationFiltersTable: dynamodb.Table;
  public readonly schedulingEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: SchedulingStackProps) {
    super(scope, id);

    // Domain-specific EventBridge Bus
    this.schedulingEventBus = new events.EventBus(this, 'SchedulingEventBus', {
      eventBusName: `scheduling-domain-${props.stage}`,
    });

    // Schedules Table
    this.schedulesTable = new dynamodb.Table(this, 'SchedulesTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scheduleId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Heats Table
    this.heatsTable = new dynamodb.Table(this, 'HeatsTable', {
      partitionKey: { name: 'scheduleId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'heatId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Classification Filters Table
    this.classificationFiltersTable = new dynamodb.Table(this, 'ClassificationFiltersTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'filterId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Scheduler Lambda (DDD)
    this.schedulerLambda = new lambda.Function(this, 'SchedulerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'ddd-handler.handler',
      code: lambda.Code.fromAsset('lambda/scheduling'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        SCHEDULES_TABLE: this.schedulesTable.tableName,
        HEATS_TABLE: this.heatsTable.tableName,
        CLASSIFICATION_FILTERS_TABLE: this.classificationFiltersTable.tableName,
        DOMAIN_EVENT_BUS: this.schedulingEventBus.eventBusName,
        CENTRAL_EVENT_BUS: props.eventBus.eventBusName,
      },
    });

    this.schedulesTable.grantReadWriteData(this.schedulerLambda);
    this.heatsTable.grantReadWriteData(this.schedulerLambda);
    this.classificationFiltersTable.grantReadWriteData(this.schedulerLambda);
    this.schedulingEventBus.grantPutEventsTo(this.schedulerLambda);
    props.eventBus.grantPutEventsTo(this.schedulerLambda);

    // Generate Schedule Lambda (Step Functions task)
    const generateScheduleLambda = new lambda.Function(this, 'GenerateScheduleLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'generate.handler',
      code: lambda.Code.fromAsset('lambda/scheduling'),
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      environment: {
        SCHEDULES_TABLE: this.schedulesTable.tableName,
      },
    });

    this.schedulesTable.grantReadWriteData(generateScheduleLambda);

    // Public Schedules Lambda
    const publicSchedulesLambda = new lambda.Function(this, 'PublicSchedulesLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'public.handler',
      code: lambda.Code.fromAsset('lambda/scheduling'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        SCHEDULES_TABLE: this.schedulesTable.tableName,
      },
    });

    this.schedulesTable.grantReadData(publicSchedulesLambda);

    // Outputs
  }
}
