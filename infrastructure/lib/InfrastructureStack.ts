import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';

export class InfrastructureStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly vpcName = 'portfolio-ecommerce-vpc';
  public readonly clusterName = 'portfolio-ecommerce-cluster';

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'SharedVpc', {
      vpcName: this.vpcName,
      maxAzs: 2,
      natGateways: 1,
    });

    this.cluster = new ecs.Cluster(this, 'SharedCluster', {
      vpc: vpc,
      clusterName: this.clusterName,
    });
  }
}
