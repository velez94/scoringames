import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface AuthorizationStackProps {
    stage: string;
    eventBus: events.EventBus;
}
export declare class AuthorizationStack extends Construct {
    readonly authorizationLambda: lambda.Function;
    readonly rolesTable: dynamodb.Table;
    readonly permissionsTable: dynamodb.Table;
    readonly userRolesTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props: AuthorizationStackProps);
}
