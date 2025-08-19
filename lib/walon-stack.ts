import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Network } from './network';
import { Bastion } from './bastion';
import { Instance } from './instance-test';


export class WalonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Parameters Section
    const envParameter = new cdk.CfnParameter(this, 'Env', {
      default: process.env.ENV
    });
    const projectParameter = new cdk.CfnParameter(this, 'Project', {
      default: process.env.PROJECT
    });

    const network = new Network(this, "Network", {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
    });

    const bastion = new Bastion(this, 'Bastion', {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
      vpc: network.vpc,
      bastionSG: network.bastionSG
    });

    const instance = new Instance(this, 'Instance', {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
      ssmRole: bastion.ssmRole,
      vpc: network.vpc,
      instanceSG: network.instanceSG
    });
  }
}
