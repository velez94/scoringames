import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
export interface CompetitionsStackProps {
    stage: string;
    eventBus: events.EventBus;
    eventImagesBucket: s3.Bucket;
    organizationEventsTable: dynamodb.Table;
    organizationMembersTable: dynamodb.Table;
    scoringSystemsTable: dynamodb.Table;
}
export declare class CompetitionsStack extends Construct {
    readonly eventsTable: dynamodb.Table;
    readonly eventDaysTable: dynamodb.Table;
    readonly competitionsEventBus: events.EventBus;
    readonly competitionsLambda: lambda.Function;
    constructor(scope: Construct, id: string, props: CompetitionsStackProps);
}
