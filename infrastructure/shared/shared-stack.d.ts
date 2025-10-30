import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface SharedStackProps {
    stage: string;
}
export declare class SharedStack extends Construct {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly eventBus: events.EventBus;
    readonly eventImagesBucket: s3.Bucket;
    constructor(scope: Construct, id: string, props: SharedStackProps);
}
