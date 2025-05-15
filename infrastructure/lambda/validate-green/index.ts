import * as https from 'https';
import * as http from 'http';
import { Context, CodeDeployEvent } from 'aws-lambda';
import { 
  CodeDeployClient, 
  PutLifecycleEventHookExecutionStatusCommand,
  PutLifecycleEventHookExecutionStatusCommandInput 
} from '@aws-sdk/client-codedeploy';

const codedeploy = new CodeDeployClient();

export const handler = async (event: CodeDeployEvent, context: Context): Promise<void> => {
  const testUrl = process.env.TEST_ENDPOINT;
  const isSecure = process.env.IS_SECURE === "true";
  
  if (!testUrl) {
    throw new Error('TEST_ENDPOINT environment variable is required');
  }
  
  console.log("Testing:", testUrl);

  let validationTestResult: 'Succeeded' | 'Failed' = 'Failed';

  try {
    const success = await new Promise<boolean>((resolve) => {
      const httpModule = isSecure ? https : http;
      
      const req = httpModule.get(testUrl, res => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', (err) => {
        console.error("Request error:", err);
        resolve(false);
      });
      
      req.end();
    });

    if (success) {
      validationTestResult = 'Succeeded';
    }
  } catch (err) {
    console.error("Health check error:", err);
  }

  const params: PutLifecycleEventHookExecutionStatusCommandInput = {
    deploymentId: event.DeploymentId,
    lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
    status: validationTestResult
  };

  try {
    await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand(params));
    console.log("Reported status:", validationTestResult);
  } catch (err) {
    console.error("Failed to report status to CodeDeploy:", err);
    throw err;
  }
};