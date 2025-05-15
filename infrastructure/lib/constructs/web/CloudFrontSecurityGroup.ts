import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

export interface CloudFrontSecurityGroupProps {
  vpc: ec2.IVpc;
  distribution?: cloudfront.Distribution;
}

export class CloudFrontSecurityGroup extends Construct {
  public readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: CloudFrontSecurityGroupProps) {
    super(scope, id);

    // Create a custom resource to find the CloudFront security group
    const cfSgFinder = new cr.AwsCustomResource(this, 'GetCloudFrontSg', {
      onCreate: {
        service: 'EC2',
        action: 'describeSecurityGroups',
        parameters: {
          Filters: [
            {
              Name: 'vpc-id',
              Values: [props.vpc.vpcId]
            },
            {
              Name: 'group-name',
              Values: ['CloudFront-VPCOrigins-Service-SG']
            }
          ]
        },
        physicalResourceId: cr.PhysicalResourceId.of('CloudFront-VPCOrigins-SG-Lookup'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Add dependency if a distribution is provided
    if (props.distribution) {
      cfSgFinder.node.addDependency(props.distribution);
    }

    // Get the security group ID from the custom resource response
    const cfSecurityGroupId = cfSgFinder.getResponseField('SecurityGroups.0.GroupId');
    
    // Create a reference to the security group
    this.securityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'CloudFrontSg',
      cfSecurityGroupId
    );
  }
}
