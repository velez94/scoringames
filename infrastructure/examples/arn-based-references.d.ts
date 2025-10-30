import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export declare class SharedStackWithArns extends cdk.Stack {
    readonly eventBusArn: string;
    readonly eventBusName: string;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
export interface CompetitionsStackWithArnsProps extends cdk.StackProps {
    eventBusArn: string;
    eventBusName: string;
    organizationEventsTableName: string;
    organizationEventsTableArn: string;
}
export declare class CompetitionsStackWithArns extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CompetitionsStackWithArnsProps);
}
export declare class MainStackWithArns extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
