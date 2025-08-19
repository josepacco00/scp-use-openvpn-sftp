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
    public readonly ssmRole: iam.Role;
    constructor(scope: Construct, id: string, props: BastionProps) {
        super(scope, id);

        // Crear un rol para permitir el acceso mediante AWS Systems Manager
        this.ssmRole = new iam.Role(this, "BastionSSMRole", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
            ]
        });

        const bastionHost = new ec2.Instance(this, 'BastionHost', {
            instanceName: `${props.env}-${props.project}-bastion-host`,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux2023({
                cachedInContext: true, // Prevent replace instance on future deploys
            }),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            securityGroup: props.bastionSG,
            role: this.ssmRole,
            associatePublicIpAddress: true,
            sourceDestCheck: false, //--> Desactiva la verificación de origen-destino para la instancia EC2.
            userData: ec2.UserData.forLinux({
                shebang: `#!/bin/bash
            
# Crear directorio para ssm-user ANTES de descargar
mkdir -p /home/ssm-user

# Resto de tu script original...
curl -o /home/ssm-user/openvpn-install.sh https://raw.githubusercontent.com/angristan/openvpn-install/refs/heads/master/openvpn-install.sh
chmod +x /home/ssm-user/openvpn-install.sh
AUTO_INSTALL=y /home/ssm-user/openvpn-install.sh

#curl -o /home/ssm-user/openvpn-install.sh https://raw.githubusercontent.com/angristan/openvpn-install/refs/heads/master/openvpn-install.sh
#chmod +x /home/ssm-user/openvpn-install.sh
#AUTO_INSTALL=y /home/ssm-user/openvpn-install.sh

sed -i 's/push "redirect/# push "redirect/' /etc/openvpn/server.conf

dnf install -y ipcalc
eval "$(ipcalc -n -m ${props.vpc.vpcCidrBlock})"
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

        new ec2.CfnEIP(this, 'BastionEIP', {
            instanceId: bastionHost.instanceId,
            tags: [
                { key: 'Name', value: `${props.env}-${props.project}-bastion-eip` }
            ]
        });


        // CORREGIR: Usar index del forEach para IDs únicos
        props.vpc.privateSubnets.forEach((subnet, index) => {
            new ec2.CfnRoute(this, `PrivateSubnetRoute${index}`, {
                routeTableId: subnet.routeTable.routeTableId,
                instanceId: bastionHost.instanceId,
                destinationCidrBlock: '0.0.0.0/0', // Rango VPN clients
            });
        });

        // let routeCount = 1;

        // props.vpc.privateSubnets.forEach((subnet) => {
        //     new ec2.CfnRoute(this, `PrivateSubnetRoute${routeCount}`, {
        //         routeTableId: subnet.routeTable.routeTableId,
        //         instanceId: bastionHost.instanceId,
        //         destinationCidrBlock: '0.0.0.0/0',
        //     })
        // })
    }
}