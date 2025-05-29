import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import { Construct } from 'constructs';

interface storageProps {
    readonly vpc: ec2.Vpc;
    readonly SecurityGroup: ec2.SecurityGroup
}

export class Storage extends Construct {
    public readonly efs: efs.FileSystem;
    public readonly accessPoint: efs.AccessPoint;
    constructor(scope: Construct, id: string, props: storageProps) {
        super(scope, id);

        this.efs = new efs.FileSystem(this, 'StorageEfs', {
            vpc: props.vpc,
            securityGroup: props.SecurityGroup,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            removalPolicy: process.env.ENV === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            throughputMode: efs.ThroughputMode.BURSTING,
            // throughputMode: efs.ThroughputMode.PROVISIONED, //--> lo usamos para levantar wordpress
            // provisionedThroughputPerSecond: cdk.Size.mebibytes(64), // 64 MiB/s
        });

        // this.accessPoint = this.efs.addAccessPoint('WordpressAccessPoint', {
        //     createAcl: {
        //         ownerGid: '1001',
        //         ownerUid: '1001',
        //         permissions: '755',
        //     },
        //     path: '/',
        //     posixUser: {
        //         gid: '1001',
        //         uid: '1001',
        //     },
        // });
    }
}