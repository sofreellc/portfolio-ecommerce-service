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
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as path from 'path';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

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
      publicLoadBalancer: false,
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

    const testListenerPort = 8081
    const testListener = new elbv2.ApplicationListener(this, 'TestListener', {
      loadBalancer: fargateService.loadBalancer,
      port: testListenerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    testListener.addTargetGroups('GreenTestTarget', {
      targetGroups: [greenTargetGroup],
    });

    const httpApi = new apigatewayv2.HttpApi(this, 'ApiGatewayHttpApi', {
      apiName: 'portfolio-api',
    });

    const vpcLinkSg = new ec2.SecurityGroup(this, 'VpcLinkSecurityGroup', {
      vpc,
      description: 'Security group for API Gateway VPC Link',
      allowAllOutbound: true,
    });

    fargateService.loadBalancer.connections.allowFrom(
        vpcLinkSg,
        ec2.Port.tcp(80),
        'Allow traffic from VPC Link to ALB'
    );
    fargateService.loadBalancer.connections.allowFrom(
        vpcLinkSg,
        ec2.Port.tcp(testListenerPort),
        'Allow traffic from VPC Link to ALB test listener'
    );

    const vpcLink = new apigatewayv2.VpcLink(this, 'VpcLinkToALB', {
      vpc,
      securityGroups: [vpcLinkSg],
      subnets: { subnets: vpc.privateSubnets, },
    });

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new integrations.HttpAlbIntegration('ALBIntegration', fargateService.listener, { vpcLink, }),
    });

    httpApi.addRoutes({
      path: '/test/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new integrations.HttpAlbIntegration('ALBTestIntegration', testListener, {
        vpcLink,
        parameterMapping: new apigatewayv2.ParameterMapping()
            // Use the proxy path parameter value
            .overwritePath(apigatewayv2.MappingValue.requestPathParam('proxy'))
      }),
    });

    const validateHookFn = new lambda.Function(this, 'ValidateGreenTargetHook', {
      functionName: "validate-green",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/validate-green')),
      environment: {
        TEST_ENDPOINT: `${httpApi.apiEndpoint}/test/`
      },
      timeout: cdk.Duration.seconds(30),
    });

    validateHookFn.addPermission('CodeDeployInvoke', {
      principal: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });
    validateHookFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['codedeploy:PutLifecycleEventHookExecutionStatus'],
      resources: ['*'],
    }));

    const errorRateAlarm = new cloudwatch.Alarm(this, 'High5xxErrorRate', {
      metric: fargateService.targetGroup.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'Too many 5xx errors during deployment',
    });

    new codedeploy.EcsDeploymentGroup(this, 'ApiDeploymentGroup', {
      deploymentGroupName: 'portfolio-ecommerce-service-dg',
      application,
      service: fargateService.service,
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
      blueGreenDeploymentConfig: {
        terminationWaitTime: cdk.Duration.minutes(5),
        blueTargetGroup: fargateService.targetGroup,
        greenTargetGroup: greenTargetGroup,
        listener: fargateService.listener,
        testListener,
      },
      role: deployRole,
      alarms: [errorRateAlarm],
    });
  }
}
