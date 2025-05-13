import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';

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

    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
    });

    const flowLogRole = new iam.Role(this, 'VpcFlowLogRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    vpc.privateSubnets.forEach((subnet, index) => {
      new ec2.FlowLog(this, `FlowLogPrivateSubnet${index}`, {
        resourceType: ec2.FlowLogResourceType.fromSubnet(subnet),
        trafficType: ec2.FlowLogTrafficType.ALL,
        destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup, flowLogRole),
      });
    });

    this.cluster = new ecs.Cluster(this, 'SharedCluster', {
      vpc: vpc,
      clusterName: this.clusterName,
    });
  }
}
