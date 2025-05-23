import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, given_name, family_name } = await request.json();

    // Validate inputs
    if (!email || !password || !given_name || !family_name) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Simple password validation
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // This URL should be constructed from the COGNITO_ISSUER environment variable
    // Remove the OAuth part from the URL to get the base URL
    const cognitoIssuer = process.env.COGNITO_ISSUER || '';
    const userPoolRegion = cognitoIssuer.match(/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com/)?.[1] || 'us-east-1';
    const userPoolId = cognitoIssuer.split('/').pop();
    
    if (!userPoolId) {
      return NextResponse.json(
        { message: 'Invalid Cognito configuration' },
        { status: 500 }
      );
    }

    // Construct the URL for the Cognito sign-up endpoint
    const cognitoEndpoint = `https://cognito-idp.${userPoolRegion}.amazonaws.com/`;

    // Make the API call to Cognito to sign up the user
    const signupResponse = await fetch(cognitoEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
      },
      body: JSON.stringify({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: given_name },
          { Name: 'family_name', Value: family_name },
        ],
      }),
    });

    if (!signupResponse.ok) {
      const errorData = await signupResponse.json();
      return NextResponse.json(
        { message: errorData.__type || 'Signup failed' },
        { status: signupResponse.status }
      );
    }

    // Return success response
    return NextResponse.json(
      { message: 'User registered successfully. Please check your email for verification.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}