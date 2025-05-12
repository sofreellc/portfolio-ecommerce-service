const http = require('https');
const { CodeDeployClient, PutLifecycleEventHookExecutionStatusCommand } = require('@aws-sdk/client-codedeploy');
const codedeploy = new CodeDeployClient();

exports.handler = async (event) => {
  const testUrl = process.env.TEST_ENDPOINT;
  console.log("Testing:", testUrl);

  let validationTestResult = 'Failed';

  try {
    const success = await new Promise((resolve) => {
      const req = http.get(testUrl, res => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.end();
    });

    if (success) {
      validationTestResult = 'Succeeded';
    }
  } catch (err) {
    console.error("Health check error:", err);
  }

  const params = {
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
