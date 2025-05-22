import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface AuthStackProps extends cdk.StackProps { }

export class AuthStack extends cdk.Stack {
    public readonly userPoolId: string;
    public readonly userPoolArn: string;
    public readonly postAuthLambdaArn: string;
    public readonly poolIdParamName: string = '/portfolio/auth/userPoolId'

    constructor(scope: Construct, id: string, props?: AuthStackProps) {
        super(scope, id, props);

        const postAuthLambda = new lambda.Function(this, 'PostAuthLambda', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/post-auth')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
        });

        const userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            standardAttributes: {
                email: { required: true, mutable: true },
                givenName: { required: true, mutable: true },
                familyName: { required: true, mutable: true },
            },
            customAttributes: {
                'claims': new cognito.StringAttribute({ mutable: true }),
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            lambdaTriggers: {
              postAuthentication: postAuthLambda
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN in production
        });

        userPool.addDomain("UserPoolDomain", {
            cognitoDomain: { domainPrefix: `portfolio-auth` },
        });

        new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'admins',
            description: 'Superuser with all permissions',
            precedence: 0,
        });

        new cognito.CfnUserPoolGroup(this, 'CuratorGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'curators',
            description: 'Create, edit or unlist products',
            precedence: 1,
        });

        new cognito.CfnUserPoolGroup(this, 'CustomerGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'customers',
            description: 'View and purchase products',
            precedence: 2,
        });

        new ssm.StringParameter(this, 'UserPoolIdParam', {
            parameterName: this.poolIdParamName,
            description: 'Cognito User Pool ID',
            stringValue: userPool.userPoolId,
        });

        this.userPoolId = userPool.userPoolId;
        this.postAuthLambdaArn = postAuthLambda.functionArn;
        this.userPoolArn = userPool.userPoolArn;
    }
}
