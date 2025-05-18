#!/opt/homebrew/opt/node/bin/node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/InfrastructureStack';
import {StageProps, Tags} from "aws-cdk-lib";
import {ApiPrereqStack} from "../lib/ApiPrereqStack";
import {ApiStack} from "../lib/ApiStack";
import {WebPrereqStack} from "../lib/WebPrereqStack";
import {WebStack} from "../lib/WebStack";
import {AuthStack} from "../lib/AuthStack";
import {AuthConfigureStack} from "../lib/AuthConfigureStack";

const app = new cdk.App();
Tags.of(app).add('workload', 'portfolio');

export interface EnvironmentConfig {
  name: string;
  account: string;
  region: string;
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    name: 'dev',
    account: '427566522857',
    region: 'us-east-1'
  },
  prod: {
    name: 'prod',
    account: '914847526688',
    region: 'us-east-1'
  }
}

export class PortfolioEnvStage extends cdk.Stage {
  constructor(scope: cdk.App, id: string, props?: StageProps) {
    super(scope, id, props);

    const infraStack = new InfrastructureStack(this, `ecommerce-infra`);

    const apiPrereqStack = new ApiPrereqStack(this, `ecommerce-api-prereq`);

    new ApiStack(this, `ecommerce-api`, {
      clusterName: infraStack.clusterName,
      vpcName: infraStack.vpcName,
      ecrRepoName: apiPrereqStack.repositoryName,
    });

    const webPrereqStack = new WebPrereqStack(this, `ecommerce-web-prereq`);

    const authStack = new AuthStack(this, 'ecommerce-auth');

    const webStack = new WebStack(this, `ecommerce-web`, {
      clusterName: infraStack.clusterName,
      vpcName: infraStack.vpcName,
      ecrRepoName: webPrereqStack.repositoryName,
      cognitoClientId: authStack.clientId,
      cognitoClientSecretName: authStack.clientSecretArn,
      cognitoIssuer: authStack.clientIssuer,
    });

    new AuthConfigureStack( this, 'ecommerce-auth-config', {
      userPoolClientId: authStack.clientId,
      userPoolId: authStack.userPoolId,
      postAuthLambdaArn: authStack.postAuthLambdaArn,
      webCloudFrontDomain: webStack.cloudFrontDomainName,
    });
  }
}

const targetEnv = app.node.tryGetContext('targetEnv')

Object.values(environments).forEach(envConfig => {
  if(targetEnv && targetEnv != envConfig.name) {
    console.log(`Skipping env`, envConfig)
    return;
  }

  new PortfolioEnvStage(app, `portfolio-stage-${envConfig.name}`, {
    env: {
      account: envConfig.account,
      region: envConfig.region
    }
  });
});
