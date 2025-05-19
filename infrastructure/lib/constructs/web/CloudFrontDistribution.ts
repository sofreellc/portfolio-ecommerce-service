import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CloudFrontSecurityGroup } from './CloudFrontSecurityGroup';

export interface CloudFrontDistributionProps {
  loadBalancer: elbv2.ApplicationLoadBalancer;
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
}

export class CloudFrontDistribution extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontDistributionProps) {
    super(scope, id);

    // Define cache policies - using separate policies for static assets and dynamic content
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      defaultTtl: cdk.Duration.days(365), // Long cache for hashed static assets
      minTtl: cdk.Duration.hours(1),
      maxTtl: cdk.Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      // Don't include Accept-Encoding in the header allowlist when enableAcceptEncodingGzip is true
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      comment: 'Cache policy for static assets with content-based hashes (JS, CSS, images)'
    });

    // Cache policy for dynamic content (default behavior)
    const dynamicContentCachePolicy = new cloudfront.CachePolicy(this, 'DynamicContentCachePolicy', {
      defaultTtl: cdk.Duration.seconds(0), // Don't cache dynamic content by default
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.minutes(1),  // Very short max TTL for dynamic content
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      // Cannot include Accept-Encoding in allowList when enableAcceptEncodingGzip is true
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Host', 'Origin', 'Authorization', 'Accept', 'Cache-Control'
      ),
      cookieBehavior: cloudfront.CacheCookieBehavior.all(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      comment: 'Cache policy for dynamic content (HTML, API responses)'
    });

    // Define origin request policy
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'WebOriginRequestPolicy', {
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Host', 'Origin', 'Referer', 'User-Agent'
      ),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    });

    // Create the distribution configuration
    const distributionConfig: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: origins.VpcOrigin.withApplicationLoadBalancer(props.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        cachePolicy: dynamicContentCachePolicy,
        originRequestPolicy: originRequestPolicy,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        // Static assets with hash pattern (_next/static/*) should use long-term caching
        '_next/static/*': {
          origin: origins.VpcOrigin.withApplicationLoadBalancer(props.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          cachePolicy: staticAssetsCachePolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        // Images with hash pattern (_next/image/*) should use long-term caching
        '_next/image/*': {
          origin: origins.VpcOrigin.withApplicationLoadBalancer(props.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          cachePolicy: staticAssetsCachePolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        // Data build manifest should use long-term caching (contains build ID)
        '_next/data/:buildId/*': {
          origin: origins.VpcOrigin.withApplicationLoadBalancer(props.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          cachePolicy: staticAssetsCachePolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: true,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 404,
          responsePagePath: '/404.html',
          responseHttpStatus: 404,
          ttl: cdk.Duration.minutes(30),
        },
        {
          httpStatus: 500,
          responsePagePath: '/500.html',
          responseHttpStatus: 500,
          ttl: cdk.Duration.minutes(5),
        },
      ],
      defaultRootObject: '',
    };

    // Add custom domain configuration if provided
    if (props.domainName && props.certificateArn) {
      const certificate = acm.Certificate.fromCertificateArn(
        this, 
        'Certificate', 
        props.certificateArn
      );
      
      // Creating distribution with domain names and certificate
      this.distribution = new cloudfront.Distribution(this, 'WebDistribution', {
        ...distributionConfig,
        certificate,
        domainNames: [props.domainName],
      });
    } else {
      // Creating distribution without domain configuration
      this.distribution = new cloudfront.Distribution(this, 'WebDistribution', distributionConfig);
    }

    // Give CF access to private LB
    const cfSecurityGroup = new CloudFrontSecurityGroup(this, 'CloudFrontSg', {
      vpc: props.loadBalancer.vpc!,
      distribution: this.distribution
    });
    props.loadBalancer.connections.allowFrom(
        cfSecurityGroup.securityGroup,
        ec2.Port.tcp(80),
        'Allow traffic from CF to ALB'
    );

    // Create DNS records if domain information is provided
    if (props.domainName && props.hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName.split('.').slice(-2).join('.'), // Extract domain.com from subdomain.domain.com
      });

      new route53.ARecord(this, 'AliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
      });
    }
  }
}
