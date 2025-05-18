import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import {GreenTarget} from "../api/GreenTarget";
import {CodeDeploy} from "../api/CodeDeploy";
import {ApiGateway} from "../api/ApiGateway";

interface WithCodeDeployProps {
  testListener?: {port: number, apiGateway?: {gateway: ApiGateway, testPath: string}}
}

export interface FargateServiceBuilderProps {
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
  usingCodeDeploy?: boolean;
  environment?: {[key: string]: string};
  secrets?: {[key: string]: string}; // key: env var name, value: Secret ARN
}

export class FargateServiceBuilder extends Construct {
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly listener: elbv2.ApplicationListener;
  public readonly fargateService: ecsPatterns.ApplicationLoadBalancedFargateService;

  private props: FargateServiceBuilderProps;
  private withCodeDeployProps?: WithCodeDeployProps;

  constructor(scope: Construct, id: string, props: FargateServiceBuilderProps) {
    super(scope, id);

    const deploymentController = props.usingCodeDeploy
        ? { type: ecs.DeploymentControllerType.CODE_DEPLOY }
        : { type: ecs.DeploymentControllerType.ECS };

    const executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

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
        environment: props.environment || {},
        secrets: this.createSecretsFromSecretManager(props.secrets || {}, taskRole, executionRole),
        taskRole: taskRole,
        executionRole: executionRole,
      },
      publicLoadBalancer: props.publicLoadBalancer || false,
      minHealthyPercent: props.minHealthyPercent || 100,
      maxHealthyPercent: props.maxHealthyPercent || 200,
      deploymentController,
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

    this.props = props;
    this.fargateService = fargateService
    this.loadBalancer = fargateService.loadBalancer
    this.listener = fargateService.listener
  }

  private createSecretsFromSecretManager(secretArns: {[key: string]: string}, taskRole: iam.Role, executionRole: iam.Role) : { [key: string]: ecs.Secret } | undefined  {
    if (Object.keys(secretArns).length === 0) {
      return undefined;
    }

    // Add permissions to read from Secrets Manager
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: Object.values(secretArns),
    }));

    executionRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: Object.values(secretArns),
    }));

    // Create secrets from Secret Manager ARNs
    const secrets: { [key: string]: ecs.Secret } = {};
    Object.entries(secretArns).forEach(([envVarName, secretArn]) => {
      const secret = secretsmanager.Secret.fromSecretCompleteArn(this, `${envVarName}Secret`, secretArn);
      secrets[envVarName] = ecs.Secret.fromSecretsManager(secret);
    });

    return secrets;
  }

  public build() : FargateServiceBuilder  {
    if(this.props.usingCodeDeploy && !this.withCodeDeployProps) {
      throw new Error(`usingCodeDeploy=true but CodeDeploy not configured`)
    }
    return this
  }

  public withCodeDeploy(withCodeDeployProps: WithCodeDeployProps = {}): this {
    const greenTarget = new GreenTarget(this, 'GreenTarget', {
      vpc: this.props.cluster.vpc,
      loadBalancer: this.fargateService.loadBalancer,
      containerPort: this.props.containerPort,
    });

    if(withCodeDeployProps.testListener) {
      greenTarget.withTestListener(
          withCodeDeployProps.testListener.port,
          withCodeDeployProps.testListener.apiGateway,
      );
    }

    new CodeDeploy(this, 'ApiDeployment', {
      serviceName: this.props.serviceName,
      service: this.fargateService.service,
      greenTarget: greenTarget,
      blueTargetGroup: this.fargateService.targetGroup,
      listener: this.fargateService.listener,
    });

    this.withCodeDeployProps = withCodeDeployProps
    return this;
  }
}
