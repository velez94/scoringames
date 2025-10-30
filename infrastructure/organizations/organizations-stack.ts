import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

export interface OrganizationsStackProps {
  stage: string;
  eventBus: events.EventBus;
}

export class OrganizationsStack extends Construct {
  public readonly organizationsTable: dynamodb.Table;
  public readonly organizationMembersTable: dynamodb.Table;
  public readonly organizationEventsTable: dynamodb.Table;
  public readonly organizationsEventBus: events.EventBus;
  public readonly organizationsLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: OrganizationsStackProps) {
    super(scope, id);

    // Domain-specific EventBridge Bus
    this.organizationsEventBus = new events.EventBus(this, 'OrganizationsEventBus', {
      eventBusName: `organizations-domain-${props.stage}`,
    });

    // Organizations Table
    this.organizationsTable = new dynamodb.Table(this, 'OrganizationsTable', {
      partitionKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Organization Members Table
    this.organizationMembersTable = new dynamodb.Table(this, 'OrganizationMembersTable', {
      partitionKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.organizationMembersTable.addGlobalSecondaryIndex({
      indexName: 'user-organizations-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
    });

    // Organization Events Table
    this.organizationEventsTable = new dynamodb.Table(this, 'OrganizationEventsTable', {
      partitionKey: { name: 'organizationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.organizationEventsTable.addGlobalSecondaryIndex({
      indexName: 'event-organization-index',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
    });

    // Organizations Lambda
    this.organizationsLambda = new lambda.Function(this, 'OrganizationsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/organizations'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ORGANIZATIONS_TABLE: this.organizationsTable.tableName,
        ORGANIZATION_MEMBERS_TABLE: this.organizationMembersTable.tableName,
        ORGANIZATION_EVENTS_TABLE: this.organizationEventsTable.tableName,
        DOMAIN_EVENT_BUS: this.organizationsEventBus.eventBusName,
        CENTRAL_EVENT_BUS: props.eventBus.eventBusName,
      },
    });

    // Grant permissions
    this.organizationsTable.grantReadWriteData(this.organizationsLambda);
    this.organizationMembersTable.grantReadWriteData(this.organizationsLambda);
    this.organizationEventsTable.grantReadWriteData(this.organizationsLambda);
    this.organizationsEventBus.grantPutEventsTo(this.organizationsLambda);
    props.eventBus.grantPutEventsTo(this.organizationsLambda);
  }
}
