import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

export interface AthletesStackProps  {
  stage: string;  eventBus: events.EventBus;
}

export class AthletesStack extends Construct {
  public readonly athletesLambda: lambda.Function;
  public readonly athletesTable: dynamodb.Table;
  public readonly athleteEventsTable: dynamodb.Table;
  public readonly athletesEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: AthletesStackProps) {
    super(scope, id);

    // Domain-specific EventBridge Bus
    this.athletesEventBus = new events.EventBus(this, 'AthletesEventBus', {
      eventBusName: `athletes-domain-${props.stage}`,
    });

    // Athletes Table
    this.athletesTable = new dynamodb.Table(this, 'AthletesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Athlete Events Table
    this.athleteEventsTable = new dynamodb.Table(this, 'AthleteEventsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.athleteEventsTable.addGlobalSecondaryIndex({
      indexName: 'event-athletes-index',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'registeredAt', type: dynamodb.AttributeType.STRING },
    });

    // Athletes Lambda
    this.athletesLambda = new lambda.Function(this, 'AthletesLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/athletes'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ATHLETES_TABLE: this.athletesTable.tableName,
        ATHLETE_EVENTS_TABLE: this.athleteEventsTable.tableName,
        DOMAIN_EVENT_BUS: this.athletesEventBus.eventBusName,
        CENTRAL_EVENT_BUS: props.eventBus.eventBusName,
      },
    });

    // Grant permissions
    this.athletesTable.grantReadWriteData(this.athletesLambda);
    this.athleteEventsTable.grantReadWriteData(this.athletesLambda);
    this.athletesEventBus.grantPutEventsTo(this.athletesLambda);
    props.eventBus.grantPutEventsTo(this.athletesLambda);

    // Outputs
  }
}
