#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WalonStack } from '../lib/walon-stack';

const app = new cdk.App();
new WalonStack(app, 'WalonStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "AWS Cirkula Stack",
  stackName: `${process.env.ENV}-${process.env.PROJECT}-stack`,
});

cdk.Tags.of(app).add('environment', process.env.ENV as string);
cdk.Tags.of(app).add('project', process.env.PROJECT as string);
