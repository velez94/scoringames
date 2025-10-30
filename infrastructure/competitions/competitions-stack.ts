import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CompetitionsStackProps  {
  stage: string;
  eventBus: events.EventBus;
  eventImagesBucket: s3.Bucket;
  organizationEventsTable: dynamodb.Table;
  organizationMembersTable: dynamodb.Table;
  scoringSystemsTable: dynamodb.Table;
}

export class CompetitionsStack extends Construct {
  public readonly eventsTable: dynamodb.Table;
  public readonly eventDaysTable: dynamodb.Table;
  public readonly competitionsEventBus: events.EventBus;
  public readonly competitionsLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: CompetitionsStackProps) {
    super(scope, id);

    // Domain-specific EventBridge Bus
    this.competitionsEventBus = new events.EventBus(this, 'CompetitionsEventBus', {
      eventBusName: `competitions-domain-${props.stage}`,
    });

    // Events Table
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startDate', type: dynamodb.AttributeType.STRING },
    });

    // Event Days Table
    this.eventDaysTable = new dynamodb.Table(this, 'EventDaysTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dayId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Competitions Lambda
    this.competitionsLambda = new lambda.Function(this, 'CompetitionsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/competitions'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        EVENT_DAYS_TABLE: this.eventDaysTable.tableName,
        EVENT_IMAGES_BUCKET: props.eventImagesBucket.bucketName,
        ORGANIZATION_EVENTS_TABLE: props.organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: props.organizationMembersTable.tableName,
        SCORING_SYSTEMS_TABLE: props.scoringSystemsTable.tableName,
        DOMAIN_EVENT_BUS: this.competitionsEventBus.eventBusName,
        CENTRAL_EVENT_BUS: props.eventBus.eventBusName,
      },
    });

    // Grant permissions
    this.eventsTable.grantReadWriteData(this.competitionsLambda);
    this.eventDaysTable.grantReadWriteData(this.competitionsLambda);
    props.eventImagesBucket.grantPut(this.competitionsLambda);
    props.organizationEventsTable.grantReadWriteData(this.competitionsLambda);
    props.organizationMembersTable.grantReadData(this.competitionsLambda);
    props.scoringSystemsTable.grantReadData(this.competitionsLambda);
    this.competitionsEventBus.grantPutEventsTo(this.competitionsLambda);
    props.eventBus.grantPutEventsTo(this.competitionsLambda);

    // Outputs
  }
}
