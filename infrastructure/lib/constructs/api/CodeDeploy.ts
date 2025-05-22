import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as path from 'path';
import {GreenTarget} from "./GreenTarget";

export interface CodeDeployProps {
  serviceName: string;
  service: ecs.FargateService;
  listener: elbv2.ApplicationListener;
  greenTarget: GreenTarget;
  blueTargetGroup: elbv2.ApplicationTargetGroup;
}

export class CodeDeploy extends Construct {
  public readonly application: codedeploy.EcsApplication;
  public readonly deploymentGroup: codedeploy.EcsDeploymentGroup;

  constructor(scope: Construct, id: string, props: CodeDeployProps) {
    super(scope, id);

    // Create a log group for the deployment
    new logs.LogGroup(this, 'DeploymentLogs', {
      logGroupName: `/aws/codedeploy/${props.serviceName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create a role for CodeDeploy
    const deployRole = new iam.Role(this, 'CodeDeployServiceRole', {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
      ],
    });

    // Create a CodeDeploy application
    this.application = new codedeploy.EcsApplication(this, 'CodeDeployApp', {
      applicationName: props.serviceName,
    });

    // Create a CloudWatch alarm for monitoring 5xx errors
    const errorRateAlarm = new cloudwatch.Alarm(this, 'High5xxErrorRate', {
      metric: props.blueTargetGroup.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'Too many 5xx errors during deployment',
    });

    const testListener = props.greenTarget.testListener?.listener
    this.deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'DeploymentGroup', {
      deploymentGroupName: `${props.serviceName}-dg`,
      application: this.application,
      service: props.service,
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
      blueGreenDeploymentConfig: {
        terminationWaitTime: cdk.Duration.minutes(5),
        blueTargetGroup: props.blueTargetGroup,
        greenTargetGroup: props.greenTarget.greenTargetGroup,
        listener: props.listener,
        testListener,
      },
      role: deployRole,
      alarms: [errorRateAlarm],
    });

    // Create a validation hook Lambda function if green target reachable
    if(props.greenTarget.testListener) {
      const validateHookFn = new lambda.Function(this, 'ValidateGreenTargetHook', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../lambda/validate-green')),
        environment: {
          TEST_ENDPOINT: props.greenTarget.testListener.testUrl,
          IS_SECURE: props.greenTarget.testListener.isSecure ? 'true' : 'false'
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
    }
  }
}
