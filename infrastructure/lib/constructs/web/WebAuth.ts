import {Construct} from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import {Stack} from "aws-cdk-lib";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import {addEnv, addSecret} from "../common/FargateServiceBuilder";

export interface AuthStackProps  {
    webCloudFrontDomain: string;
    userPoolId: string
    fargateService: ecsPatterns.ApplicationLoadBalancedFargateService;
}

export class WebAuth extends Construct {
    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id);

        const userPool = cognito.UserPool.fromUserPoolId(this, 'ImportedUserPool', props.userPoolId);

        const webClient = userPool.addClient('web-client', {
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
            ],
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
                logoutUrls: [
                    'http://localhost:3000/auth/login',
                    `https://${props.webCloudFrontDomain}/auth/login`,
                ],
                callbackUrls: [
                    'http://localhost:3000/api/auth/callback/cognito',
                    `https://${props.webCloudFrontDomain}/api/auth/callback/cognito`,
                ],
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

        addEnv(props.fargateService, {
            'COGNITO_CLIENT_ID': webClient.userPoolClientId,
            'COGNITO_ISSUER': `https://cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`,
        })
        addSecret(this, props.fargateService, {
            'COGNITO_CLIENT_SECRET': webClientSecret.secretArn
        });

    }
}
