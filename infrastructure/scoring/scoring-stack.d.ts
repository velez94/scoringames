import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface ScoringStackProps {
    stage: string;
    eventBus: events.EventBus;
}
export declare class ScoringStack extends Construct {
    readonly scoresLambda: lambda.Function;
    readonly exercisesLambda: lambda.Function;
    readonly scoresTable: dynamodb.Table;
    readonly scoringSystemsTable: dynamodb.Table;
    readonly leaderboardCacheTable: dynamodb.Table;
    readonly exerciseLibraryTable: dynamodb.Table;
    readonly scoringEventBus: events.EventBus;
    constructor(scope: Construct, id: string, props: ScoringStackProps);
}
