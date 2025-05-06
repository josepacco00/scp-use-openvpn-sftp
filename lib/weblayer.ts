import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';


interface AppLayerProps {
    readonly vpc: ec2.Vpc;
    readonly securityGroup: ec2.SecurityGroup;
    readonly instanceType: string;
    readonly amiId: string;
    readonly efsId: string;

    readonly redisHost: string;

    readonly s3Bucket: string;
}

export class AppLayer extends Construct {
    public readonly autoscalingGroup: autoscaling.AutoScalingGroup;

    constructor(scope: Construct, id: string, props: AppLayerProps) {
        super(scope, id);

        const instancesRole = new iam.Role(this, 'InstancesRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
            ],
            // s3 write access
            inlinePolicies: {
                'S3BucketPolicy': new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
                            resources: [`arn:aws:s3:::${props.s3Bucket}/*`],
                        }),
                        new iam.PolicyStatement({
                            actions: ['s3:ListBucket'],
                            resources: [`arn:aws:s3:::${props.s3Bucket}`],
                        }),
                    ],
                }),
            },
        });

        const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
            instanceType: new ec2.InstanceType(props.instanceType),
            machineImage: ec2.MachineImage.genericLinux({ 'us-east-1': props.amiId }),
            userData: ec2.UserData.custom(`#!/bin/bash
mount -t efs ${props.efsId} /var/www/

echo "\nphp_value[session.save_handler] = redis" >> /etc/php-fpm.d/www.conf 
echo "php_value[session.save_path]    = tcp://${props.redisHost}:6379" >> /etc/php-fpm.d/www.conf

service grafana-agent restart
service php-fpm start
service nginx start`),
            securityGroup: props.securityGroup,
            role: instancesRole,
        });
        cdk.Tags.of(launchTemplate).add('Name', `${process.env.ENV}-${process.env.PROJECT_NAME}`);

        this.autoscalingGroup = new autoscaling.AutoScalingGroup(this, "ASG", {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            minCapacity: 2,
            maxCapacity: 10,
            healthCheck: autoscaling.HealthCheck.elb({ grace: cdk.Duration.seconds(60) }),
            cooldown: cdk.Duration.seconds(60),
            mixedInstancesPolicy: {
                launchTemplate: launchTemplate,
                instancesDistribution: {
                    onDemandBaseCapacity: 2,
                    onDemandPercentageAboveBaseCapacity: 0,
                },
            },
        });

        this.autoscalingGroup.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: 50,
            estimatedInstanceWarmup: cdk.Duration.seconds(30),
        });
    }
}