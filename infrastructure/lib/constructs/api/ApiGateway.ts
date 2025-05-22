import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export interface ApiGatewayProps {
  vpc: ec2.IVpc;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  primaryListener: elbv2.ApplicationListener;
}

export class ApiGateway extends Construct {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly vpcLink: apigatewayv2.VpcLink;
  private readonly vpcLinkSg: ec2.SecurityGroup;
  private readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    // Create an HTTP API
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi');

    // Create a security group for the VPC Link
    const vpcLinkSg = new ec2.SecurityGroup(this, 'VpcLinkSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for API Gateway VPC Link',
      allowAllOutbound: true,
    });

    // Allow traffic from the VPC Link to the load balancer
    props.loadBalancer.connections.allowFrom(
      vpcLinkSg,
      ec2.Port.tcp(80),
      'Allow traffic from VPC Link to ALB'
    );

    // Create a VPC Link
    this.vpcLink = new apigatewayv2.VpcLink(this, 'VpcLinkToALB', {
      vpc: props.vpc,
      securityGroups: [vpcLinkSg],
      subnets: { subnets: props.vpc.privateSubnets },
    });

    // Add routes to the HTTP API
    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new integrations.HttpAlbIntegration('ALBIntegration', props.primaryListener, {
        vpcLink: this.vpcLink,
      }),
    });

    this.vpcLinkSg = vpcLinkSg
    this.loadBalancer = props.loadBalancer
  }

  public addRoute(name: string, listener: elbv2.ApplicationListener, listenerPort: number) {
    this.loadBalancer.connections.allowFrom(
        this.vpcLinkSg,
        ec2.Port.tcp(listenerPort),
        `Allow traffic from VPC Link to ALB ${name} listener`
    );

    this.httpApi.addRoutes({
      path: `/${name}/{proxy+}`,
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new integrations.HttpAlbIntegration(`ALB${name}Integration`, listener, {
        vpcLink: this.vpcLink,
        parameterMapping: new apigatewayv2.ParameterMapping()
            .overwritePath(apigatewayv2.MappingValue.requestPathParam('proxy'))
      }),
    });
  }
}
