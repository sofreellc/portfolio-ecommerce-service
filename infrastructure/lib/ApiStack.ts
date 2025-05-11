import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface ApiStackProps extends cdk.StackProps {
  vpcName: string;
  clusterName: string;
  ecrRepoName: string;
}

export class ApiStack extends cdk.Stack {
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

    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster,
      serviceName: 'portfolio-ecommerce-service',
      memoryLimitMiB: 512,
      cpu: 256,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
        containerPort: 8080,
        containerName: 'portfolio-ecommerce-service',
      },
      publicLoadBalancer: true,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
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

    new logs.LogGroup(this, 'DeploymentLogs', {
      logGroupName: '/aws/codedeploy/portfolio-ecommerce-service',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const deployRole = new iam.Role(this, 'CodeDeployServiceRole', {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
      ],
    });

    const application = new codedeploy.EcsApplication(this, 'ApiCodeDeployApp', {
      applicationName: 'portfolio-ecommerce-service',
    });

    const greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTargetGroup', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });

    const testListener = new elbv2.ApplicationListener(this, 'TestListener', {
      loadBalancer: fargateService.loadBalancer,
      port: 8081,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    testListener.addTargetGroups('GreenTestTarget', {
      targetGroups: [greenTargetGroup],
    });

    new codedeploy.EcsDeploymentGroup(this, 'ApiDeploymentGroup', {
      deploymentGroupName: 'portfolio-ecommerce-service-dg',
      application,
      service: fargateService.service,
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
      blueGreenDeploymentConfig: {
        deploymentApprovalWaitTime: cdk.Duration.minutes(15),
        terminationWaitTime: cdk.Duration.minutes(5),
        blueTargetGroup: fargateService.targetGroup,
        greenTargetGroup: greenTargetGroup,
        listener: fargateService.listener,
        testListener,
      },
      role: deployRole,
    });
  }
}
