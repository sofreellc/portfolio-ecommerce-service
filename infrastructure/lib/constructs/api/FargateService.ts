import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface FargateServiceProps {
  cluster: ecs.ICluster;
  repository: ecr.IRepository;
  serviceName: string;
  containerPort: number;
  memoryLimitMiB?: number;
  cpu?: number;
  desiredCount?: number;
  minHealthyPercent?: number;
  maxHealthyPercent?: number;
  publicLoadBalancer?: boolean;
}

export class FargateService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly listener: elbv2.ApplicationListener;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly containerName: string;

  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    super(scope, id);

    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster: props.cluster,
      serviceName: props.serviceName,
      memoryLimitMiB: props.memoryLimitMiB || 512,
      cpu: props.cpu || 256,
      desiredCount: props.desiredCount || 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(props.repository),
        containerPort: props.containerPort,
        containerName: props.serviceName,
      },
      publicLoadBalancer: props.publicLoadBalancer || false,
      minHealthyPercent: props.minHealthyPercent || 100,
      maxHealthyPercent: props.maxHealthyPercent || 200,
      deploymentController: { type: ecs.DeploymentControllerType.CODE_DEPLOY },
    });

    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    this.service = fargateService.service;
    this.loadBalancer = fargateService.loadBalancer;
    this.listener = fargateService.listener;
    this.targetGroup = fargateService.targetGroup;
    this.containerName = props.serviceName;
  }
}
