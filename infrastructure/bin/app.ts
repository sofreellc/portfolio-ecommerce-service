#!/opt/homebrew/opt/node/bin/node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
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

Object.values(environments).forEach(envConfig => {
  new InfrastructureStack(app, `ecommerce-service-${envConfig.name}`, {
    env: {
      account: envConfig.account,
      region: envConfig.region
    },
  });
});


