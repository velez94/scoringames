import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
export interface NetworkStackProps {
    stage: string;
    userPool: cognito.UserPool;
}
export declare class NetworkStack extends Construct {
    readonly api: apigateway.RestApi;
    readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;
    constructor(scope: Construct, id: string, props: NetworkStackProps);
}
