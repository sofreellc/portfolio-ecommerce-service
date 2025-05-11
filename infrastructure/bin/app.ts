#!/opt/homebrew/opt/node/bin/node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/InfrastructureStack';
import { Tags } from "aws-cdk-lib";

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

const targetEnv = app.node.tryGetContext('targetEnv')

Object.values(environments).forEach(envConfig => {
  if(targetEnv && targetEnv != envConfig.name) {
    console.log(`Skipping env`, envConfig)
    return;
  }
  new InfrastructureStack(app, `ecommerce-infra-${envConfig.name}`, {
    env: {
      account: envConfig.account,
      region: envConfig.region
    },
  });
});

