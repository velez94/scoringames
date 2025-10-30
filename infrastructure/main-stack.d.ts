import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface ScorinGamesStackProps extends cdk.StackProps {
    stage: string;
}
export declare class ScorinGamesStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ScorinGamesStackProps);
}
