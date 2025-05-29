import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as waf from 'aws-cdk-lib/aws-wafv2';

interface CdnProps {
    readonly env: string;
    readonly project: string;
    readonly loadbalancer: elbv2.ApplicationLoadBalancer;
    readonly certificateArn: string;
    readonly domainName: string;
    readonly webAclId: string;
}

export class Cdn extends Construct {
    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: CdnProps) {
        super(scope, id);

        const albOrigin = new cloudfrontOrigins.LoadBalancerV2Origin(props.loadbalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            readTimeout: Duration.seconds(90),
        });

        // 1. Política de NO caché para el comportamiento por defecto
        const noCachePolicy = new cloudfront.CachePolicy(this, 'NoCachePolicy', {
            cachePolicyName: `${props.env}-${props.project}-no-cache`,
            comment: 'Bypass cache by default for WordPress',
            minTtl: Duration.seconds(0),
            defaultTtl: Duration.seconds(1), // ✅Usamos esto para que cloudfront nos permita pasar los cookies/headers/querystrings
            maxTtl: Duration.seconds(10),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Host'),
            cookieBehavior: cloudfront.CacheCookieBehavior.all(),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        });

        // 2. Política de caché solo para contenido estático con manejo de versionado
        const staticCachePolicy = new cloudfront.CachePolicy(this, 'StaticCachePolicy', {
            cachePolicyName: `${props.env}-${props.project}-static-cache`,
            comment: 'Cache policy for static content with wordpress versioning support',
            minTtl: Duration.days(1),
            defaultTtl: Duration.days(30),
            maxTtl: Duration.days(365),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Host', 'Accept'),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList(
                'ver',       // WordPress standard
            ),
        });

        // 3. Origin Request Policy (común para todos los comportamientos)
        // const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicy', {
        //     originRequestPolicyName: `${props.envName}-${props.projectName}-origin-request`,
        //     cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
        //     headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        //         'Host',
        //         'User-Agent',
        //         'Referer',
        //         'Accept',
        //         'Accept-Language',
        //         'Accept-Encoding'
        //     ),
        //     queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        // }); -->🚫VERIFICAR SI ES NECESARIO🚫



        // 2. Definición de rutas estáticas
        const staticRoutes = [
            // Rutas específicas de WordPress (mayor prioridad)
            { path: '/wp-content/uploads/*' },
            { path: '/wp-content/themes/*' },
            { path: '/wp-includes/*' },

            // Archivos estáticos por extensión
            { path: '*.js' },
            { path: '*.css' },
            { path: '*.mjs' },

            // Imágenes
            { path: '*.jpg' },
            { path: '*.jpeg' },
            { path: '*.png' },
            { path: '*.webp' },
            { path: '*.svg' },
            { path: '*.gif' },

            // Fuentes
            { path: '*.woff' },
            { path: '*.woff2' },
            { path: '*.ttf' },
            { path: '*.eot' },

            // Otros
            { path: '*.ico' },
            { path: '*.pdf' }
        ];

        // 3. Creación de behaviors adicionales a partir del array
        const additionalBehaviors: Record<string, cloudfront.BehaviorOptions> = {};

        staticRoutes.forEach(route => {
            additionalBehaviors[route.path] = {
                origin: albOrigin,
                cachePolicy: staticCachePolicy,
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER, //🚫Verificar
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                compress: true
            };
        });

        // 6. Creación de la distribución CloudFront
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: albOrigin,
                cachePolicy: noCachePolicy,
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER, //🚫Verificar
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                //cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                compress: true,
            },
            additionalBehaviors: additionalBehaviors,
            certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn),
            domainNames: [props.domainName],
            webAclId: props.webAclId,
            //priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
        });
    }
}