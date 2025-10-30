import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

export interface WodsStackProps  {
  stage: string;  eventBus: events.EventBus;
  organizationEventsTable: dynamodb.Table;
  organizationMembersTable: dynamodb.Table;
}

export class WodsStack extends Construct {
  public readonly wodsLambda: lambda.Function;
  public readonly wodsTable: dynamodb.Table;
  public readonly wodsEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: WodsStackProps) {
    super(scope, id);

    // Domain-specific EventBridge Bus
    this.wodsEventBus = new events.EventBus(this, 'WodsEventBus', {
      eventBusName: `wods-domain-${props.stage}`,
    });

    // WODs Table
    this.wodsTable = new dynamodb.Table(this, 'WodsTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'wodId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // WODs Lambda
    this.wodsLambda = new lambda.Function(this, 'WodsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/wods'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        WODS_TABLE: this.wodsTable.tableName,
        ORGANIZATION_EVENTS_TABLE: props.organizationEventsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: props.organizationMembersTable.tableName,
        DOMAIN_EVENT_BUS: this.wodsEventBus.eventBusName,
        CENTRAL_EVENT_BUS: props.eventBus.eventBusName,
      },
    });

    // Grant permissions
    this.wodsTable.grantReadWriteData(this.wodsLambda);
    props.organizationEventsTable.grantReadData(this.wodsLambda);
    props.organizationMembersTable.grantReadData(this.wodsLambda);
    this.wodsEventBus.grantPutEventsTo(this.wodsLambda);
    props.eventBus.grantPutEventsTo(this.wodsLambda);

    // Outputs
  }
}
