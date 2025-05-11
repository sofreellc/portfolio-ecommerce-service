#!/opt/homebrew/opt/node/bin/node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/InfrastructureStack';
import {StageProps, Tags} from "aws-cdk-lib";
import {ApiPrereqStack} from "../lib/ApiPrereqStack";

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

    new InfrastructureStack(this, `ecommerce-infra`);

    new ApiPrereqStack(this, `ecommerce-api-prereq`)
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
