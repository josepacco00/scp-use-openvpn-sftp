import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Network } from './network';
import { Storage } from './storage';
import { Bastion } from './bastion';
import { Database } from './database';
//import { Application } from './application';

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

    //Base Resources
    const network = new Network(this, "Network", {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
    });

    const storage = new Storage(this, 'Storage', {
      vpc: network.vpc,
      SecurityGroup: network.bastionSG
    });

    // const database = new Database(this, 'Database', {
    //   env: envParameter.valueAsString,
    //   project: projectParameter.valueAsString,
    //   vpc: network.vpc,
    //   securityGroup: network.databaseSG
    // });

    const bastion = new Bastion(this, 'Bastion', {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
      vpc: network.vpc,
      bastionSG: network.bastionSG
    });

  }
}
