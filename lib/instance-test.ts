import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

interface InstanceProps {
    readonly env: string;
    readonly project: string;
    readonly ssmRole: iam.Role;
    readonly vpc: ec2.Vpc;
    readonly instanceSG: ec2.SecurityGroup;
}

export class Instance extends Construct {
    constructor(scope: Construct, id: string, props: InstanceProps) {
        super(scope, id);

        const instance = new ec2.Instance(this, 'Instance', {
            instanceName: `${props.env}-${props.project}-instance`,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux2023({
                cachedInContext: true, // Prevent replace instance on future deploys
            }),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroup: props.instanceSG,
            role: props.ssmRole,
        });
    }
}