import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface NetworkProps {
    readonly env: string;
    readonly project: string;
}

export class Network extends Construct {
    public readonly vpc: ec2.Vpc;
    public readonly instanceSG: ec2.SecurityGroup;
    public readonly bastionSG: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props: NetworkProps) {
        super(scope, id);

        this.vpc = new ec2.Vpc(this, "VPC", {
            vpcName: `${props.env}-${props.project}-vpc`,
            natGateways: 0,
            ipAddresses: ec2.IpAddresses.cidr(process.env.VPC_CIDR as string),
            restrictDefaultSecurityGroup: false,
            subnetConfiguration: [
                {
                    cidrMask: 20,
                    name: "Public",
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 20,
                    name: "Private",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 20,
                    name: "Isolated",
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });

        this.bastionSG = new ec2.SecurityGroup(this, 'BastionSG', { vpc: this.vpc, description: 'Security Group para el Bastion Host' });
        this.instanceSG = new ec2.SecurityGroup(this, 'InstanceSG', { vpc: this.vpc, description: 'Security Group para las Instancias' });

        this.bastionSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(1194), 'Allow traffic for internet for OpenVPN');
        this.bastionSG.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.allTraffic(), 'Allow all traffic from VPC');
        this.instanceSG.addIngressRule(this.bastionSG, ec2.Port.allTraffic(), 'Allow all traffic from Bastion');
    }
}
