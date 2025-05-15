import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { FargateServiceBuilder } from './constructs/common/FargateServiceBuilder';
import { CloudFrontDistribution } from './constructs/web/CloudFrontDistribution';

export interface WebStackProps extends cdk.StackProps {
  vpcName: string;
  clusterName: string;
  ecrRepoName: string;
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
}

export class WebStack extends cdk.Stack {
  private readonly serviceName = 'portfolio-ecommerce-web';
  private readonly containerPort = 3000;

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
    }).build();

    new CloudFrontDistribution(this, 'WebDistribution', {
      loadBalancer: fargateService.loadBalancer,
      domainName: props.domainName,
      certificateArn: props.certificateArn,
      hostedZoneId: props.hostedZoneId,
    });
  }
}
