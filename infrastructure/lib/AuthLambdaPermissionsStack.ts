import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";

export interface AuthLambdaPermissionsStackProps extends cdk.StackProps {
    userPoolId: string
    postAuthLambdaArn: string
}

export class AuthLambdaPermissionsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AuthLambdaPermissionsStackProps) {
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
    }
}
