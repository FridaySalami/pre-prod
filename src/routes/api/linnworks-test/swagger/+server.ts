import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const POST = GET;

export async function GET() {
  try {
    const accessToken = env.LINNWORKS_ACCESS_TOKEN;

    if (!accessToken) {
      return json({
        success: false,
        error: "Missing LINNWORKS_ACCESS_TOKEN in environment variables"
      }, { status: 500 });
    }

    console.log("Testing Linnworks API using Swagger documentation approach");

    // First approach: Try direct API call using token in Authorization header
    // This is the approach shown in the Swagger docs
    console.log("Approach 1: Direct API call with token in Authorization header");

    const directResponse = await fetch('https://eu-ext.linnworks.net/api/Dashboards/GetTopProducts?type=GroupedByQuantity&period=1&numRows=5&orderStatus=3', {
      method: 'GET',
      headers: {
        'Authorization': accessToken,
        'Accept': 'application/json'
      }
    });

    console.log("Direct API call response status:", directResponse.status);

    if (directResponse.ok) {
      const directData = await directResponse.json();
      return json({
        success: true,
        method: "direct_api_call",
        message: "Successfully called Linnworks API using direct Authorization header",
        data: directData
      });
    }

    const directText = await directResponse.text();
    console.log("Direct API call error:", directText);

    // Second approach: Try the token authorization endpoint first
    console.log("Approach 2: Get session token via AuthorizeByToken first");

    const authResponse = await fetch('https://eu-ext.linnworks.net/api/Auth/AuthorizeByToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: accessToken })
    });

    if (!authResponse.ok) {
      // If that fails, try with "Token" capitalized
      console.log("First attempt failed, trying with capitalized 'Token' parameter");

      const authResponse2 = await fetch('https://eu-ext.linnworks.net/api/Auth/AuthorizeByToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Token: accessToken })
      });

      if (!authResponse2.ok) {
        const errorText = await authResponse2.text();
        return json({
          success: false,
          error: `Both auth attempts failed. Latest error: ${authResponse2.status}: ${errorText}`,
          directApiError: directText
        }, { status: 500 });
      }

      const authData = await authResponse2.json();

      if (!authData.Token) {
        return json({
          success: false,
          error: "Auth succeeded but no Token in response",
          authResponse: authData
        }, { status: 500 });
      }

      // If we get here, we have a session token
      const sessionToken = authData.Token;

      // Now try the API call with the session token
      const apiResponse = await fetch('https://eu-ext.linnworks.net/api/Dashboards/GetTopProducts?type=GroupedByQuantity&period=1&numRows=5&orderStatus=3', {
        method: 'GET',
        headers: {
          'Authorization': sessionToken,
          'Accept': 'application/json'
        }
      });

      if (!apiResponse.ok) {
        const apiErrorText = await apiResponse.text();
        return json({
          success: false,
          error: `API call failed: ${apiResponse.status}: ${apiErrorText}`,
          authSucceeded: true
        }, { status: 500 });
      }

      const apiData = await apiResponse.json();

      return json({
        success: true,
        method: "session_token",
        message: "Successfully called Linnworks API using session token",
        data: apiData
      });
    }

    // Initial auth call succeeded
    const authData = await authResponse.json();

    if (!authData.Token) {
      return json({
        success: false,
        error: "Auth succeeded but no Token in response",
        authResponse: authData
      }, { status: 500 });
    }

    // We have a session token
    const sessionToken = authData.Token;

    // Try the API call with the session token
    const apiResponse = await fetch('https://eu-ext.linnworks.net/api/Dashboards/GetTopProducts?type=GroupedByQuantity&period=1&numRows=5&orderStatus=3', {
      method: 'GET',
      headers: {
        'Authorization': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      const apiErrorText = await apiResponse.text();
      return json({
        success: false,
        error: `API call failed: ${apiResponse.status}: ${apiErrorText}`,
        authSucceeded: true
      }, { status: 500 });
    }

    const apiData = await apiResponse.json();

    return json({
      success: true,
      method: "session_token",
      message: "Successfully called Linnworks API using session token",
      data: apiData
    });
  } catch (error) {
    console.error("Linnworks Swagger test error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}