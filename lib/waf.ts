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
                // Core rule set
                {
                    name: 'AWS-AWSManagedRulesCommonRuleSet',
                    priority: 1,
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
                    priority: 2,
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
                    priority: 3,
                    action: {
                        block: {}, // --> Bloquear, para produccion, previa evaluacion
                        //count: {}, //--> Solo contabilizar, no bloquear
                    },
                    statement: {
                        rateBasedStatement: {
                            limit: 2000,
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
                    priority: 4,
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