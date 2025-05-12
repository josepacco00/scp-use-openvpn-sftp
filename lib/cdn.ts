import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

interface CdnProps {
    readonly env: string;
    readonly project: string;
    readonly loadbalancer: elbv2.ApplicationLoadBalancer;
    readonly certificateArn: string;
    readonly domainName: string;
}

export class Cdn extends Construct {
    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: CdnProps) {
        super(scope, id);

        const albOrigin = new cloudfrontOrigins.LoadBalancerV2Origin(props.loadbalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            readTimeout: Duration.seconds(60),
        });

        const cachePolicy = new cloudfront.CachePolicy(this, `CachePolicy`, {
            cachePolicyName: `${props.env}-${props.project}-backend-cache-policy`,
            minTtl: Duration.seconds(0),
            defaultTtl: Duration.days(0),
            maxTtl: Duration.days(365),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
        });

        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: albOrigin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY, //REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
                compress: true,
                cachePolicy: cachePolicy,
            },
            certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn),
            domainNames: [props.domainName],
            //priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
        });
    }
}