import { json } from '@sveltejs/kit';
import * as env from '$env/static/private';

// Add POST handler that calls the same function as GET
export const POST = GET;

export async function GET() {
  try {
    // Step 1: Get credentials
    console.log("Starting complete Linnworks auth test...");
    const appId = env.LINNWORKS_APP_ID;
    const appSecret = env.LINNWORKS_APP_SECRET;
    const accessToken = env.LINNWORKS_ACCESS_TOKEN;
    
    // Verify we have the necessary credentials
    if (!appId || !appSecret || !accessToken) {
      return json({
        success: false,
        error: "Missing required credentials",
        missingAppId: !appId,
        missingAppSecret: !appSecret,
        missingAccessToken: !accessToken
      }, { status: 500 });
    }
    
    console.log("All credentials available");
    console.log("App ID (first 4 chars):", appId.substring(0, 4) + "...");
    console.log("Access Token (first 4 chars):", accessToken.substring(0, 4) + "...");
    
    // Step 2: Get a session token using the access token
    console.log("Authenticating with access token...");
    
    const authResponse = await fetch('https://eu-ext.linnworks.net/api/Auth/AuthorizeByToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: accessToken })
    });
    
    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      return json({
        success: false,
        error: `Access token auth error: ${authResponse.status}: ${errorText}`
      }, { status: 500 });
    }
    
    // Try direct authentication with token in header
    const testResponse = await fetch('https://eu-ext.linnworks.net/api/Dashboards/GetTopProducts?type=GroupedByQuantity&period=1&numRows=10&orderStatus=3', {
      method: 'GET',
      headers: {
        'Authorization': accessToken,
        'Accept': 'application/json'
      }
    });

    // Rest of your function...
    return json({
      success: true,
      message: "Authentication successful!"
    });
  } catch (error) {
    console.error("Complete auth test error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}