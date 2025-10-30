import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface WodsStackProps {
    stage: string;
    eventBus: events.EventBus;
    organizationEventsTable: dynamodb.Table;
    organizationMembersTable: dynamodb.Table;
}
export declare class WodsStack extends Construct {
    readonly wodsLambda: lambda.Function;
    readonly wodsTable: dynamodb.Table;
    readonly wodsEventBus: events.EventBus;
    constructor(scope: Construct, id: string, props: WodsStackProps);
}
