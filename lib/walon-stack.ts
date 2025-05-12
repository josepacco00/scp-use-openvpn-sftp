import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Network } from './network';
import { Storage } from './storage';
import { Bastion } from './bastion';
import { Database } from './database';
import { WebLayer } from './weblayer';
import { LoadBalancer } from './alb';
import { Cdn } from './cdn';

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

    const domainNameParameter = new cdk.CfnParameter(this, 'DomainName');
    const certificateArnParameter = new cdk.CfnParameter(this, 'CertificateArn');
    const amiIdParameter = new cdk.CfnParameter(this, 'AmiId');

    //Base Resources
    const network = new Network(this, "Network", {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
    });

    const storage = new Storage(this, 'Storage', {
      vpc: network.vpc,
      SecurityGroup: network.efsSG
    });

    const database = new Database(this, 'Database', {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
      vpc: network.vpc,
      securityGroup: network.databaseSG
    });

    const bastion = new Bastion(this, 'Bastion', {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
      vpc: network.vpc,
      bastionSG: network.bastionSG
    });

    const webLayer = new WebLayer(this, 'AppLayer', {
      vpc: network.vpc,
      weblayerSG: network.webLayerSG,
      amiId: amiIdParameter.valueAsString,
      efsId: storage.efs.fileSystemId
    });

    const alb = new LoadBalancer(this, 'LoadBalancer', {
      vpc: network.vpc,
      albSG: network.albSG,
      certificateArn: certificateArnParameter.valueAsString,
      autoscalingGroup: webLayer.autoscalingGroup
    });

    const cdn = new Cdn(this, 'Cdn', {
      env: envParameter.valueAsString,
      project: projectParameter.valueAsString,
      loadbalancer: alb.loadBalancer,
      certificateArn: certificateArnParameter.valueAsString,
      domainName: domainNameParameter.valueAsString,
    });
  }
}
