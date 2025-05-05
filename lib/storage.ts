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
            removalPolicy: process.env.ENV === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });

        this.accessPoint = this.efs.addAccessPoint('WordpressAccessPoint', {
            createAcl: {
                ownerGid: '1001',
                ownerUid: '1001',
                permissions: '755',
            },
            path: '/',
            posixUser: {
                gid: '1001',
                uid: '1001',
            },
        });
    }
}