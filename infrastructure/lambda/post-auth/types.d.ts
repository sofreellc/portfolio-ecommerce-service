declare namespace NodeJS {
  interface ProcessEnv {
  }
}

declare module 'aws-lambda' {
  export interface PostAuthenticationTriggerEvent {
    userName: string,
    userPoolId: string,
    request: {
      userAttributes: Record<string, any>
    }
  }
  export interface Context { }
}
