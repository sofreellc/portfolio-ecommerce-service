declare namespace NodeJS {
  interface ProcessEnv {
    TEST_ENDPOINT: string;
    IS_SECURE: string;
  }
}

declare module 'aws-lambda' {
  export interface CodeDeployEvent {
    DeploymentId: string;
    LifecycleEventHookExecutionId: string;
  }
  export interface Context { }
}
