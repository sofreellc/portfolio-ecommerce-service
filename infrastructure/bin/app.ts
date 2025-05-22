#!/opt/homebrew/opt/node/bin/node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/InfrastructureStack';
import {Tags} from "aws-cdk-lib";
import {ApiStateStack} from "../lib/ApiStateStack";
import {ApiStack} from "../lib/ApiStack";
import {WebStateStack} from "../lib/WebStateStack";
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

const targetEnv = app.node.tryGetContext('targetEnv');

class PortfolioStage extends cdk.Stage {
  constructor(scope: cdk.App, id: string, props: cdk.StageProps) {
    super(scope, id, props);
    const infraStack = new InfrastructureStack(this, 'infra', { env: props.env });

    const authStack = new AuthStack(this, 'auth');
    new AuthConfigureStack(this, 'auth-config', {
      userPoolId: authStack.userPoolId,
      postAuthLambdaArn: authStack.postAuthLambdaArn,
    });

    const apiStateStack = new ApiStateStack(this, 'api-state');
    new ApiStack(this, 'api', {
      clusterName: infraStack.clusterName,
      vpcName: infraStack.vpcName,
      ecrRepoName: apiStateStack.repositoryName,
    });

    const webStateStack = new WebStateStack(this, 'web-state');
    new WebStack(this, 'web', {
      clusterName: infraStack.clusterName,
      vpcName: infraStack.vpcName,
      ecrRepoName: webStateStack.repositoryName,
      userPoolId: authStack.userPoolId,
    });
  }
}

Object.values(environments).forEach(envConfig => {
  if (targetEnv && targetEnv !== envConfig.name) {
    console.log(`Skipping env`, envConfig);
    return;
  }

  const env = {
    account: envConfig.account,
    region: envConfig.region,
    name: envConfig.name,
  };

  new PortfolioStage(app, `ecommerce-service-${envConfig.name}`, { env });
});
