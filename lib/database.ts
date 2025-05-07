import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";

export interface DatabaseProps {
    readonly env: string;
    readonly project: string;
    readonly vpc: ec2.Vpc;
    readonly securityGroup: ec2.SecurityGroup;
}

export class Database extends Construct {
    public readonly database: rds.DatabaseCluster;
    public readonly secret: secretsmanager.Secret;

    constructor(scope: Construct, id: string, props: DatabaseProps) {
        super(scope, id);

        this.secret = new secretsmanager.Secret(this, "Secret", {
            secretName: `${props.env}-${props.project}-database-secret`,
            generateSecretString: {
                excludePunctuation: true,
                passwordLength: 20,
                generateStringKey: "password",
                secretStringTemplate: JSON.stringify({
                    username: "root",
                }),
            },
        });

        const clusterParameterGroup = new rds.ParameterGroup(
            this,
            "ClusterParameterGroup",
            {
                description: "Parameter group for Walon Aurora Mysql cluster",
                engine: rds.DatabaseClusterEngine.auroraMysql({
                    version: rds.AuroraMysqlEngineVersion.VER_3_05_2,
                }),
                parameters: {
                    //timezone: "UTC", -> NO FUNCIONA EN AURORA MYSQL 
                },
            }
        );

        this.database = new rds.DatabaseCluster(this, "Database", {
            clusterIdentifier: `${props.env}-${props.project}-aurora-cluster`,
            engine: rds.DatabaseClusterEngine.auroraMysql({
                version: rds.AuroraMysqlEngineVersion.VER_3_05_2,
            }),
            writer: rds.ClusterInstance.serverlessV2("DatabaseWriter", {
                instanceIdentifier: `${props.env}-${props.project}-aurora-writer`,
                enablePerformanceInsights: true,
            }),
            securityGroups: [props.securityGroup],
            defaultDatabaseName: "walon",
            credentials: rds.Credentials.fromSecret(this.secret),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
            storageEncrypted: true,
            monitoringInterval: Duration.minutes(1),
            parameterGroup: clusterParameterGroup,
            serverlessV2MinCapacity: 0.5,
            serverlessV2MaxCapacity: 5,
            removalPolicy: process.env.ENV === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
    }
}
