import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

export interface AuthorizationStackProps {
  stage: string;
  eventBus: events.EventBus;
}

export class AuthorizationStack extends Construct {
  public readonly authorizationLambda: lambda.Function;
  public readonly rolesTable: dynamodb.Table;
  public readonly permissionsTable: dynamodb.Table;
  public readonly userRolesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: AuthorizationStackProps) {
    super(scope, id);

    // Roles Table
    this.rolesTable = new dynamodb.Table(this, 'RolesTable', {
      partitionKey: { name: 'roleId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Permissions Table
    this.permissionsTable = new dynamodb.Table(this, 'PermissionsTable', {
      partitionKey: { name: 'roleId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'resource', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // User Roles Table (with caching)
    this.userRolesTable = new dynamodb.Table(this, 'UserRolesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'contextId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Authorization Lambda
    this.authorizationLambda = new lambda.Function(this, 'AuthorizationLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/authorization'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        ROLES_TABLE: this.rolesTable.tableName,
        PERMISSIONS_TABLE: this.permissionsTable.tableName,
        USER_ROLES_TABLE: this.userRolesTable.tableName,
      },
    });

    // Grant permissions
    this.rolesTable.grantReadWriteData(this.authorizationLambda);
    this.permissionsTable.grantReadWriteData(this.authorizationLambda);
    this.userRolesTable.grantReadWriteData(this.authorizationLambda);
  }
}
