import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { FargateServiceBuilder } from './constructs/common/FargateServiceBuilder';
import { ApiGateway } from './constructs/api/ApiGateway';

export interface ApiStackProps extends cdk.StackProps {
  vpcName: string;
  clusterName: string;
  ecrRepoName: string;
}

export class ApiStack extends cdk.Stack {
  private readonly serviceName = 'portfolio-ecommerce-service';
  private readonly containerPort = 8080;
  private readonly testListenerPort = 8081;
  private readonly testListenerApiPath = 'test';

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
      vpcName: props.vpcName,
    });

    const cluster = ecs.Cluster.fromClusterAttributes(this, 'ImportedCluster', {
      clusterName: props.clusterName,
      vpc,
    });

    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'ImportedRepo', props.ecrRepoName);

    const fargateService = new FargateServiceBuilder(this, 'ApiService', {
      cluster,
      repository: ecrRepository,
      serviceName: this.serviceName,
      containerPort: this.containerPort,
      memoryLimitMiB: 512,
      cpu: 256,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      publicLoadBalancer: false,
      usingCodeDeploy: true,
    });

    const apiGateway = new ApiGateway(this, 'ApiGateway', {
      vpc,
      loadBalancer: fargateService.loadBalancer,
      primaryListener: fargateService.listener,
      apiName: 'portfolio-api'
    });

    fargateService
        .withCodeDeploy({
          testListener: {
            port: this.testListenerPort,
            apiGateway: {gateway: apiGateway, testPath: this.testListenerApiPath} }
        }).build()
  }
}
