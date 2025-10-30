import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface AthletesStackProps {
    stage: string;
    eventBus: events.EventBus;
}
export declare class AthletesStack extends Construct {
    readonly athletesLambda: lambda.Function;
    readonly athletesTable: dynamodb.Table;
    readonly athleteEventsTable: dynamodb.Table;
    readonly athletesEventBus: events.EventBus;
    constructor(scope: Construct, id: string, props: AthletesStackProps);
}
