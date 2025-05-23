'use client';

import { getCsrfToken } from "next-auth/react";

/**
 * Sign-in function that reliably handles OAuth flows by using direct form submission
 * instead of fetch API, avoiding CORS and opaque redirect issues
 *
 * @param provider The OAuth provider to sign in with (e.g., "cognito")
 * @param redirectTo The URL to redirect to after successful authentication
 */
export async function directSignIn(
  provider: string,
  redirectTo: string = '/'
): Promise<void> {
  try {
    console.log("Starting direct sign-in process...");

    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      console.error("Failed to get CSRF token");
      return;
    }

    console.log("Got CSRF token:", csrfToken);

    // Create a hidden form for direct form submission
    // This approach avoids XHR/fetch and CORS issues
    const form = document.createElement('form');
    form.method = 'post';
    form.action = `/api/auth/signin/${provider}`;
    form.style.display = 'none';

    // Add CSRF token (required by NextAuth)
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'csrfToken';
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);

    // Add callback URL
    const callbackInput = document.createElement('input');
    callbackInput.type = 'hidden';
    callbackInput.name = 'callbackUrl';
    callbackInput.value = redirectTo;
    form.appendChild(callbackInput);

    // Add the form to the document and submit
    document.body.appendChild(form);
    console.log("Submitting form...");
    form.submit();

    // Clean up the form after submission
    setTimeout(() => {
      if (document.body.contains(form)) {
        document.body.removeChild(form);
      }
    }, 1000);
  } catch (error) {
    console.error("Sign in error:", error);
    // TODO: improve UX if form submit fails.
    alert("Authentication error. Please try again.");
  }
}

/**
 * Sign-out function that reliably handles sign-out flows by using direct form submission
 * instead of fetch API, avoiding CORS and redirect handling issues
 *
 * @param redirectTo The URL to redirect to after successful sign out
 */
export async function directSignOut(
  redirectTo: string = '/'
): Promise<void> {
  try {
    console.log("Starting direct sign-out process...");

    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      console.error("Failed to get CSRF token");
      return;
    }

    console.log("Got CSRF token for sign-out:", csrfToken);

    // Create a hidden form for direct form submission
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/api/auth/signout';
    form.style.display = 'none';

    // Add CSRF token (required by NextAuth)
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'csrfToken';
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);

    // Add callback URL
    const callbackInput = document.createElement('input');
    callbackInput.type = 'hidden';
    callbackInput.name = 'callbackUrl';
    callbackInput.value = redirectTo;
    form.appendChild(callbackInput);

    // Add the form to the document and submit
    document.body.appendChild(form);
    console.log("Submitting sign-out form...");
    form.submit();

    // Clean up the form after submission
    setTimeout(() => {
      if (document.body.contains(form)) {
        document.body.removeChild(form);
      }
    }, 1000);
  } catch (error) {
    console.error("Sign out error:", error);
    // Fallback if form submission fails
    window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(redirectTo)}`;
  }
}
