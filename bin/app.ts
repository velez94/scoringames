#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ScorinGamesStack } from '../infrastructure/main-stack';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage') || 'dev';

new ScorinGamesStack(app, 'ScorinGames', {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
