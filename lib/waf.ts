import { Construct } from 'constructs';
import * as waf from 'aws-cdk-lib/aws-wafv2';

interface IWafProps {
    readonly env: string;
    readonly project: string;
}

export class Waf extends Construct {
    public readonly webAcl: waf.CfnWebACL;

    constructor(scope: Construct, id: string, props: IWafProps) {
        super(scope, id);

        const whiteList = new waf.CfnIPSet(this, 'WhiteList', {
            name: `${props.env}-${props.project}-whitelist`,
            scope: 'CLOUDFRONT',
            ipAddressVersion: 'IPV4',
            addresses: [],
        });

        const whiteListPawment = new waf.CfnIPSet(this, 'WhiteListPayment', {
            name: `${props.env}-${props.project}-whitelist-payment`,
            scope: 'CLOUDFRONT',
            ipAddressVersion: 'IPV4',
            addresses: [],
        });

        this.webAcl = new waf.CfnWebACL(this, 'WebAcl', {
            name: `${props.env}-${props.project}-waf`,
            defaultAction: {
                allow: {},
            },
            scope: 'CLOUDFRONT',
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: `${props.env}-${props.project}-waf`,
                sampledRequestsEnabled: true,
            },
            rules: [
                //white-list
                {
                    name: 'AllowListRule',
                    priority: 0,
                    action: {
                        allow: {},
                    },
                    statement: {
                        ipSetReferenceStatement: {
                            arn: whiteList.attrArn,
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: `${props.env}-${props.project}-waf-allowlist`,
                    },
                },
                //white-list-payment
                {
                    name: 'AllowListPaymentRule',
                    priority: 1,
                    action: {
                        allow: {},
                    },
                    statement: {
                        ipSetReferenceStatement: {
                            arn: whiteListPawment.attrArn,
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: `${props.env}-${props.project}-waf-allowlist-payment`,
                    },
                },
                // Core rule set
                {
                    name: 'AWS-AWSManagedRulesCommonRuleSet',
                    priority: 2,
                    overrideAction: {
                        none: {},
                    },
                    statement: {
                        managedRuleGroupStatement: {
                            vendorName: 'AWS',
                            name: 'AWSManagedRulesCommonRuleSet',
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: `${props.env}-${props.project}-waf-aws-managed-rules`,
                    },
                },

                // Amazon IP reputation list
                {
                    name: 'AWS-AWSManagedRulesAmazonIpReputationList',
                    priority: 3,
                    overrideAction: {
                        none: {},
                    },
                    statement: {
                        managedRuleGroupStatement: {
                            vendorName: 'AWS',
                            name: 'AWSManagedRulesAmazonIpReputationList',
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: `${props.env}-${props.project}-waf-amazon-ip-reputation`,
                    },
                },
                // Limite de solicitudes x IP
                {
                    name: 'RateLimitRule',
                    priority: 4,
                    action: {
                        block: {}, // --> Bloquear, para produccion, previa evaluacion
                        //count: {}, //--> Solo contabilizar, no bloquear
                    },
                    statement: {
                        rateBasedStatement: {
                            limit: 500,
                            aggregateKeyType: 'FORWARDED_IP',
                            forwardedIpConfig: {
                                fallbackBehavior: 'MATCH',
                                headerName: 'X-Forwarded-For', // Necesario para cloufront
                            }
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: `${props.env}-${props.project}-waf-rate-limit`,
                    },
                },
                // SQL database
                {
                    name: 'AWS-AWSManagedRulesSQLiRuleSet',
                    priority: 5,
                    overrideAction: {
                        none: {},
                    },
                    statement: {
                        managedRuleGroupStatement: {
                            vendorName: 'AWS',
                            name: 'AWSManagedRulesSQLiRuleSet',
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: `${props.env}-${props.project}-waf-sql-injection`,
                    },
                },
                //Amazon Boots <--! se añadio
                // {
                //     name: 'AWSManagedRulesBotControlRuleSet',
                //     priority: 6,
                //     overrideAction: { none: {} },
                //     statement: {
                //         managedRuleGroupStatement: {
                //             vendorName: 'AWS',
                //             name: 'AWSManagedRulesBotControlRuleSet',
                //         },
                //     },
                //     visibilityConfig: {
                //         sampledRequestsEnabled: true,
                //         cloudWatchMetricsEnabled: true,
                //         metricName: `${process.env.ENV}-${process.env.PROJECT}-apiGateway-WAF--bot-control`,
                //     },
                // },




                // {
                //     name: 'AWS-AWSManagedRulesWordPressRuleSet',
                //     priority: 2,
                //     overrideAction: {
                //         none: {},
                //     },
                //     statement: {
                //         managedRuleGroupStatement: {
                //             vendorName: 'AWS',
                //             name: 'AWSManagedRulesWordPressRuleSet',
                //         },
                //     },
                //     visibilityConfig: {
                //         sampledRequestsEnabled: true,
                //         cloudWatchMetricsEnabled: true,
                //         metricName: `${props.env}-${props.project}-waf-wordpress`,
                //     },
                // }

                // Bot control --> AWSManagedRulesBotControlRuleSet //cuesta $10
                // WordPress specific vulnerabilities --> cuesta $10

            ]
        });

    }
}