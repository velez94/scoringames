import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface SchedulingStackProps {
    stage: string;
    eventBus: events.EventBus;
}
export declare class SchedulingStack extends Construct {
    readonly schedulerLambda: lambda.Function;
    readonly schedulesTable: dynamodb.Table;
    readonly heatsTable: dynamodb.Table;
    readonly classificationFiltersTable: dynamodb.Table;
    readonly schedulingEventBus: events.EventBus;
    constructor(scope: Construct, id: string, props: SchedulingStackProps);
}
