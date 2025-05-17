import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import {Stack} from "aws-cdk-lib";

export interface AuthStackProps extends cdk.StackProps {
    webCloudFrontDomain?: string;
}

export class AuthStack extends cdk.Stack {
    public readonly userPoolId: string;
    public readonly userPoolArn: string;
    public readonly clientId: string;
    public readonly clientSecretArn: string;
    public readonly clientIssuer: string;
    public readonly postAuthLambdaArn: string;

    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id, props);

        const postAuthLambda = new lambda.Function(this, 'PostAuthLambda', {
            functionName: 'post-auth',
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

        const webClient = userPool.addClient('web-client', {
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            preventUserExistenceErrors: true,
            generateSecret: true,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callbackUrls: [
                    'http://localhost:3000/api/auth/callback/cognito',
                    props.webCloudFrontDomain ? `https://${props.webCloudFrontDomain}/api/auth/callback/cognito` : undefined,
                ].filter(Boolean) as string[],
                logoutUrls: [
                    'http://localhost:3000/auth/login',
                    props.webCloudFrontDomain ? `https://${props.webCloudFrontDomain}/auth/login` : undefined,
                ].filter(Boolean) as string[],
            },
            readAttributes: new cognito.ClientAttributes()
                .withStandardAttributes({
                    email: true,
                    emailVerified: true,
                    givenName: true,
                    familyName: true,
                })
                .withCustomAttributes('claims'),
        });

        const webClientSecret = new secretsmanager.Secret(this, 'WebClientSecret', {
            secretName: '/ecommerce/auth/webClientSecret',
            description: 'Secret for web client',
            secretStringValue: webClient.userPoolClientSecret,
        });

        this.userPoolId = userPool.userPoolId;
        this.postAuthLambdaArn = postAuthLambda.functionArn;
        this.userPoolArn = userPool.userPoolArn;
        this.clientId = webClient.userPoolClientId;
        this.clientIssuer = `https://cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`;
        this.clientSecretArn = webClientSecret.secretArn;

    }
}
