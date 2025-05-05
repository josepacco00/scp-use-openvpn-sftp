import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

interface BastionProps {
    readonly env: string;
    readonly project: string;
    readonly vpc: ec2.Vpc;
    readonly bastionSG: ec2.SecurityGroup;
}

export class Bastion extends Construct {
    constructor(scope: Construct, id: string, props: BastionProps) {
        super(scope, id);

        // Crear un rol para permitir el acceso mediante AWS Systems Manager
        const ssmRole = new iam.Role(this, "BastionSSMRole", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
            ]
        });

        const bastionHost = new ec2.Instance(this, 'BastionHost', {
            instanceName: `${props.env}-${props.project}-bastion-host`,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux2023(),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            securityGroup: props.bastionSG,
            role: ssmRole,
            associatePublicIpAddress: true
        });
    }
}