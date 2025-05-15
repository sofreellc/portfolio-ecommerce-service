import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { StackProps } from "aws-cdk-lib";

export class WebPrereqStack extends cdk.Stack {
    public readonly repositoryName = 'portfolio-ecommerce-web';

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        new ecr.Repository(this, 'WebRepository', {
            repositoryName: this.repositoryName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            emptyOnDelete: true,
        });
    }
}