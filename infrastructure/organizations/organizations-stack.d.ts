import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface OrganizationsStackProps {
    stage: string;
    eventBus: events.EventBus;
}
export declare class OrganizationsStack extends Construct {
    readonly organizationsTable: dynamodb.Table;
    readonly organizationMembersTable: dynamodb.Table;
    readonly organizationEventsTable: dynamodb.Table;
    readonly organizationsEventBus: events.EventBus;
    readonly organizationsLambda: lambda.Function;
    constructor(scope: Construct, id: string, props: OrganizationsStackProps);
}
