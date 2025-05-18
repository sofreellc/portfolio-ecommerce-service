import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from 'aws-cdk-lib/custom-resources';

export interface AuthConfigureStackProps extends cdk.StackProps {
    userPoolId: string
    userPoolClientId: string
    postAuthLambdaArn: string
    webCloudFrontDomain: string;
}

export class AuthConfigureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AuthConfigureStackProps) {
        super(scope, id);

        const userPool = cognito.UserPool.fromUserPoolId(this, 'ImportedUserPool', props.userPoolId);
        const postAuthLambda = lambda.Function.fromFunctionArn(this, "PostAuthLambda", props.postAuthLambdaArn)

        // Grant permissions for the Lambda to work with Cognito
        postAuthLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'cognito-idp:AdminListGroupsForUser',
                'cognito-idp:AdminUpdateUserAttributes',
            ],
            resources: [userPool.userPoolArn],
        }));

        // Grant Cognito permission to invoke the Lambda
        postAuthLambda.addPermission('CognitoInvocation', {
            principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: userPool.userPoolArn,
        });

        new cr.AwsCustomResource(this, 'UpdateAuthorizedUrls', {
            onUpdate: {
                service: 'CognitoIdentityServiceProvider',
                action: 'updateUserPoolClient',
                parameters: {
                    UserPoolId: props.userPoolId,
                    ClientId: props.userPoolClientId,
                    CallbackURLs: [
                        'http://localhost:3000/api/auth/callback/cognito',
                        props.webCloudFrontDomain ? `https://${props.webCloudFrontDomain}/api/auth/callback/cognito` : undefined,
                    ].filter(Boolean) as string[],
                    LogoutURLs: [
                        'http://localhost:3000/auth/login',
                        props.webCloudFrontDomain ? `https://${props.webCloudFrontDomain}/auth/login` : undefined,
                    ].filter(Boolean) as string[],
                },
                physicalResourceId: cr.PhysicalResourceId.of(
                    `${props.userPoolClientId}-update-urls`,
                ),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [userPool.userPoolArn],
            }),
        });
    }
}
