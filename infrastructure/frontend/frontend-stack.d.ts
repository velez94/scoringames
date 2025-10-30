import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
export interface FrontendStackProps {
    stage: string;
}
export declare class FrontendStack extends Construct {
    readonly bucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props: FrontendStackProps);
}
