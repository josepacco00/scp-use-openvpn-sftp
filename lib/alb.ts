import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cdk from 'aws-cdk-lib';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

interface LoadBalancerProps {
    readonly vpc: ec2.Vpc;
    readonly albSG: ec2.SecurityGroup;
    readonly certificateArn: string;
    readonly autoscalingGroup: autoscaling.AutoScalingGroup;
}

export class LoadBalancer extends Construct {
    public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

    constructor(scope: Construct, id: string, props: LoadBalancerProps) {
        super(scope, id);

        this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "ALB", {
            vpc: props.vpc,
            internetFacing: true,
            vpcSubnets: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
            securityGroup: props.albSG,
        });

        this.loadBalancer.addListener("Listener80", {
            port: 80,
            open: false,
            defaultAction: elbv2.ListenerAction.redirect({
                protocol: "HTTPS",
                permanent: true,
                port: "443",
            }),
        });

        // this.loadBalancer.addListener("Listener80", {
        //     port: 80,
        //     open: true, // Deja abierto el puerto 80 para redirección
        //     defaultAction: elbv2.ListenerAction.redirect({
        //         protocol: "HTTPS",
        //         permanent: true,
        //         port: "443",
        //         host: "#{host}", // Asegúrate de que el host se esté resolviendo correctamente
        //         path: "/#{path}", // Asegúrate de que la ruta se pase correctamente
        //         query: "#{query}" // Esto pasa los parámetros de la query si los hubiera
        //     }),
        // });


        const httpsListener = this.loadBalancer.addListener("Listener443", {
            port: 443,
            open: false,
            certificates: [
                elbv2.ListenerCertificate.fromArn(props.certificateArn),
            ]
        });

        httpsListener.addTargets("TargetGroup", {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targets: [props.autoscalingGroup],
            healthCheck: {
                path: "/health/check.php", ///status.php -> en teoria se deberia apuntar al status.php PERO funciona con /
                interval: cdk.Duration.seconds(10),
                timeout: cdk.Duration.seconds(5),
                healthyHttpCodes: "200,303,302", // Se agrego el 302, por que TG me indicaba ese error
                port: "80",
                healthyThresholdCount: 3,
                unhealthyThresholdCount: 2,
            },
        });
    }
}