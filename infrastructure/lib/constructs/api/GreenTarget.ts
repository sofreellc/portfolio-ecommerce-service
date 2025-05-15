import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {ApiGateway} from "./ApiGateway";

export interface GreenTargetProps {
  vpc: ec2.IVpc;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  containerPort: number
}

export class GreenTarget extends Construct {
  private readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly greenTargetGroup: elbv2.ApplicationTargetGroup;
  public testListener?: {listener: elbv2.ApplicationListener, testUrl: string, isSecure: boolean};

  constructor(scope: Construct, id: string, props: GreenTargetProps) {
    super(scope, id);

    this.greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTargetGroup', {
      vpc: props.vpc,
      port: props.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });

    this.loadBalancer = props.loadBalancer;
  }

  withTestListener(testListenerPort: number, apiGateway?: {gateway: ApiGateway, testPath: string}): GreenTarget {
    // Create a test listener for testing the green deployment
    const testListener = new elbv2.ApplicationListener(this, 'TestListener', {
      loadBalancer: this.loadBalancer,
      port: testListenerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    this.testListener = {
      listener: testListener,
      testUrl: `http://${this.loadBalancer.loadBalancerDnsName}:${testListenerPort}/`,
      isSecure: false
    }

    testListener.addTargetGroups('GreenTestTarget', {
      targetGroups: [this.greenTargetGroup],
    });

    if(apiGateway) {
      apiGateway.gateway.addRoute(apiGateway.testPath, testListener, testListenerPort)
      this.testListener.testUrl = `${apiGateway.gateway.httpApi.apiEndpoint}/${apiGateway.testPath}/`
      this.testListener.isSecure = true;
    }

    return this;
  }
}
