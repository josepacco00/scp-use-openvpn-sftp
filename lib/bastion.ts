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
            machineImage: ec2.MachineImage.latestAmazonLinux2023({
                cachedInContext: true, // Prevent replace instance on future deploys
            }),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            securityGroup: props.bastionSG,
            role: ssmRole,
            associatePublicIpAddress: true,
            sourceDestCheck: false, //--> Desactiva la verificación de origen-destino para la instancia EC2.
            userData: ec2.UserData.forLinux({
                shebang: `#!/bin/bash
curl -o /tmp/openvpn-install.sh https://raw.githubusercontent.com/angristan/openvpn-install/refs/heads/master/openvpn-install.sh
chmod +x /tmp/openvpn-install.sh
AUTO_INSTALL=y /tmp/openvpn-install.sh

sed -i 's/push "redirect/# push "redirect/' /etc/openvpn/server.conf

dnf install -y ipcalc
eval "$(ipcalc -n -m ${process.env.VPC_CIDR})"
echo 'push "route' $NETWORK $NETMASK'"' >> /etc/openvpn/server.conf
service openvpn-server@server restart

yum install iptables-services -y
systemctl enable iptables
systemctl start iptables

iptables -t nat -A POSTROUTING -o ens5 -j MASQUERADE
iptables -F FORWARD
iptables -F INPUT
service iptables save
                `
            }),
        });

        // const cfnInstance = bastionHost.node.defaultChild as ec2.CfnInstance;
        // cfnInstance.disableApiTermination = true;

        new ec2.CfnEIP(this, 'BastionEIP', {
            instanceId: bastionHost.instanceId,
            tags: [
                { key: 'Name', value: `${props.env}-${props.project}-bastion-eip` }
            ]
        });

        let routeCount = 1;
        props.vpc.privateSubnets.forEach((subnet) => {
            new ec2.CfnRoute(this, `PrivateSubnetRoute${routeCount++}`, {
                routeTableId: subnet.routeTable.routeTableId,
                instanceId: bastionHost.instanceId,
                destinationCidrBlock: '0.0.0.0/0',
            });
        });
    }
}

// # Verifica el log del User Data
// cat /var/log/cloud-init-output.log