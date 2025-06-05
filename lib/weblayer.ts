import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';


interface WebLayerProps {
    readonly vpc: ec2.Vpc;
    readonly weblayerSG: ec2.SecurityGroup;
    readonly amiId: string;
    readonly efsId: string;
}

export class WebLayer extends Construct {
    public readonly autoscalingGroup: autoscaling.AutoScalingGroup;

    constructor(scope: Construct, id: string, props: WebLayerProps) {
        super(scope, id);

        const instancesRole = new iam.Role(this, 'InstancesRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
            ],
            inlinePolicies: {
            },
        });

        const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.C8G, ec2.InstanceSize.LARGE),
            //instanceType: ec2.InstanceType.of(ec2.InstanceClass.C7A, ec2.InstanceSize.MEDIUM),
            machineImage: ec2.MachineImage.genericLinux({ 'us-east-1': props.amiId }),
            securityGroup: props.weblayerSG,
            role: instancesRole,
            userData: ec2.UserData.custom(`#!/bin/bash
timedatectl set-timezone America/Lima
yum install htop -y
mount -t efs ${props.efsId}:/ /var/www/

service php-fpm start
service nginx start`),
        });

        this.autoscalingGroup = new autoscaling.AutoScalingGroup(this, "ASG", {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            minCapacity: 2, //
            desiredCapacity: 2, //
            maxCapacity: 6, //
            healthCheck: autoscaling.HealthCheck.elb({ grace: cdk.Duration.seconds(60) }),
            instanceMonitoring: autoscaling.Monitoring.BASIC,
            cooldown: cdk.Duration.seconds(60),
            mixedInstancesPolicy: {
                launchTemplate: launchTemplate,
                instancesDistribution: {
                    onDemandBaseCapacity: 4,
                    onDemandPercentageAboveBaseCapacity: 0,
                    //onDemandPercentageAboveBaseCapacity: 50,   // 50% On-Demand, 50% Spot
                    //spotAllocationStrategy: 'capacity-optimized', // Mejor estrategia para Spot

                },
            },
        });

        this.autoscalingGroup.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: 50,
            estimatedInstanceWarmup: cdk.Duration.seconds(30),
        });
    }
}