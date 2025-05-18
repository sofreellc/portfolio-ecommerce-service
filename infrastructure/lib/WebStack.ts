import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { FargateServiceBuilder } from './constructs/common/FargateServiceBuilder';
import { CloudFrontDistribution } from './constructs/web/CloudFrontDistribution';

export interface WebStackProps extends cdk.StackProps {
  vpcName: string;
  clusterName: string;
  ecrRepoName: string;
  cognitoClientId: string;
  cognitoClientSecretName: string;
  cognitoIssuer: string;
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
  nextAuthSecret?: string;
}

export class WebStack extends cdk.Stack {
  private readonly serviceName = 'portfolio-ecommerce-web';
  private readonly containerPort = 3000;
  public readonly cloudFrontDomainName: string;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
      vpcName: props.vpcName,
    });

    const cluster = ecs.Cluster.fromClusterAttributes(this, 'ImportedCluster', {
      clusterName: props.clusterName,
      vpc,
    });

    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'ImportedRepo', props.ecrRepoName);

    const nextAuthSecretValue = new cdk.aws_secretsmanager.Secret(this, 'NextAuthSecret', {
      secretName: `/ecommerce/web/nextAuthSecret`,
      description: 'Secret for NextAuth.js authentication',
      generateSecretString: {}
    });

    const fargateService = new FargateServiceBuilder(this, 'WebService', {
      cluster,
      repository: ecrRepository,
      serviceName: this.serviceName,
      containerPort: this.containerPort,
      memoryLimitMiB: 1024,
      cpu: 512,
      desiredCount: 2,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      publicLoadBalancer: false,
      environment: {
        'COGNITO_CLIENT_ID': props.cognitoClientId,
        'COGNITO_ISSUER': props.cognitoIssuer,
      },
      secrets: {
        'COGNITO_CLIENT_SECRET': props.cognitoClientSecretName,
        'NEXTAUTH_SECRET': nextAuthSecretValue.secretArn,
      },
    }).build();

    const cloudFrontDistribution = new CloudFrontDistribution(this, 'WebDistribution', {
      loadBalancer: fargateService.loadBalancer,
      domainName: props.domainName,
      certificateArn: props.certificateArn,
      hostedZoneId: props.hostedZoneId,
    });

    const cfnTask = fargateService.fargateService.taskDefinition.node.defaultChild as cdk.aws_ecs.CfnTaskDefinition;
    cfnTask.addDependency(cloudFrontDistribution.distribution.node.defaultChild as cdk.CfnResource);

    const webContainer = fargateService.fargateService.taskDefinition.defaultContainer!;

    // Set main NextAuth URL to CloudFront distribution
    const cloudFrontDomain = cloudFrontDistribution.distribution.distributionDomainName;
    const nextAuthUrl = `https://${cloudFrontDomain}`;

    // Setup NextAuth environment variables
    const nextAuthEnv = {
      'NEXTAUTH_URL': nextAuthUrl,
      'NEXTAUTH_URL_INTERNAL': nextAuthUrl, // Same as external URL
      'NEXTAUTH_TRUST_HOST': 'true',
      'NEXTAUTH_DEBUG': 'true',
      'NEXTAUTH_TRUSTED_HOSTS': `${cloudFrontDomain},.*\\.cloudfront\\.net,ip-[0-9]+-[0-9]+-[0-9]+-[0-9]+\\.ec2\\.internal(:[0-9]+)?,localhost(:[0-9]+)?`,
    };

    // Add all NextAuth environment variables
    Object.entries(nextAuthEnv).forEach(([key, value]) => {
      webContainer.addEnvironment(key, value);
    });

    this.cloudFrontDomainName = cloudFrontDistribution.distribution.distributionDomainName;
  }
}
