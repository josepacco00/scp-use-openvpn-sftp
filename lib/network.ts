import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface NetworkProps {
    readonly env: string;
    readonly project: string;
}

export class Network extends Construct {
    public readonly vpc: ec2.Vpc;
    public readonly albSG: ec2.SecurityGroup;
    public readonly webLayerSG: ec2.SecurityGroup;
    public readonly bastionSG: ec2.SecurityGroup;
    public readonly databaseSG: ec2.SecurityGroup;
    public readonly lambdaSG: ec2.SecurityGroup;
    public readonly efsSG: ec2.SecurityGroup;


    constructor(scope: Construct, id: string, props: NetworkProps) {
        super(scope, id);

        this.vpc = new ec2.Vpc(this, "VPC", {
            vpcName: `${props.env}-${props.project}-vpc`,
            natGateways: 0,
            gatewayEndpoints: {
                S3: {
                    service: ec2.GatewayVpcEndpointAwsService.S3,
                },
                DynamoDB: {
                    service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
                },
            },
            availabilityZones: ["us-east-1c", "us-east-1d"],
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

        this.databaseSG = new ec2.SecurityGroup(this, 'DatabaseSG', { vpc: this.vpc, description: 'Security Group para la Base de Datos' });
        this.albSG = new ec2.SecurityGroup(this, 'AlbSG', { vpc: this.vpc, description: 'Security Group para el ALB' });
        this.webLayerSG = new ec2.SecurityGroup(this, 'AppLayerSG', { vpc: this.vpc, description: 'Security Group para la Capa de Aplicaciones' });
        this.bastionSG = new ec2.SecurityGroup(this, 'BastionSG', { vpc: this.vpc, description: 'Security Group para el Bastion Host' });
        this.lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', { vpc: this.vpc, description: 'Security Group para Lambda' });
        this.efsSG = new ec2.SecurityGroup(this, 'EfsSG', { vpc: this.vpc, description: 'Security Group para EFS' });

        this.efsSG.addIngressRule(this.webLayerSG, ec2.Port.tcp(2049), 'Allow access to EFS');
        this.databaseSG.addIngressRule(this.webLayerSG, ec2.Port.tcp(3306), 'Allow access to Database');
        this.databaseSG.addIngressRule(this.bastionSG, ec2.Port.tcp(3306), 'Allow access to Database');

        this.webLayerSG.addIngressRule(this.albSG, ec2.Port.tcp(80), 'Allow access to ALB');
        this.webLayerSG.addIngressRule(this.bastionSG, ec2.Port.allTraffic(), 'Allow access to Bastion');

        //this.albSG.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(80), 'Allow inbound traffic from anywhere on port 80');
        //this.albSG.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(443), 'Allow inbound traffic from anywhere on port 443');

        this.bastionSG.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.allTraffic(), 'Allow all traffic from VPC')
        this.bastionSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(1194));
        //this.apiOpenSearchALBSG.addIngressRule(ec2.Peer.prefixList('pl-3b927c52'), ec2.Port.allTcp(), 'Allow trafic access from CDN');
    }
}
