import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface NetworkProps {
    readonly env: string;
    readonly project: string;
}

export class Network extends Construct {
    public readonly vpc: ec2.Vpc;
    public readonly albSG: ec2.SecurityGroup;
    public readonly bastionSG: ec2.SecurityGroup;
    public readonly databaseSG: ec2.SecurityGroup;
    public readonly lambdaSG: ec2.SecurityGroup;
    public readonly efsSG: ec2.SecurityGroup;


    constructor(scope: Construct, id: string, props: NetworkProps) {
        super(scope, id);

        this.vpc = new ec2.Vpc(this, "VPC", {
            vpcName: `${props.env}-${props.project}-vpc`,
            natGateways: 1,
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

        this.databaseSG = new ec2.SecurityGroup(this, 'DatabaseSG', { vpc: this.vpc });
        this.albSG = new ec2.SecurityGroup(this, 'AlbSG', { vpc: this.vpc });
        this.bastionSG = new ec2.SecurityGroup(this, 'BastionSG', { vpc: this.vpc });
        this.lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', { vpc: this.vpc });
        this.efsSG = new ec2.SecurityGroup(this, 'EfsSG', { vpc: this.vpc });
    }
}
