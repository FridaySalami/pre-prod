import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const POST = GET;

export async function GET() {
  try {
    console.log("Testing Linnworks OpenOrders/GetViewStats API endpoint...");

    // Step 1: Authenticate with Linnworks first
    const applicationId = env.LINNWORKS_APP_ID;
    const applicationSecret = env.LINNWORKS_APP_SECRET;
    const accessToken = env.LINNWORKS_ACCESS_TOKEN;

    if (!applicationId || !applicationSecret || !accessToken) {
      return json({
        success: false,
        error: "Missing required credentials"
      }, { status: 500 });
    }

    console.log("Authenticating with Linnworks...");

    const authResponse = await fetch('https://api.linnworks.net/api/Auth/AuthorizeByApplication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        "ApplicationId": applicationId,
        "ApplicationSecret": applicationSecret,
        "Token": accessToken
      })
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      return json({
        success: false,
        error: `Authentication failed: ${authResponse.status}: ${errorText}`
      }, { status: 500 });
    }

    const authData = await authResponse.json();

    // Check key properties
    if (!authData.Token || !authData.Server) {
      return json({
        success: false,
        error: "Missing Token or Server in response",
        authResponse: authData
      }, { status: 500 });
    }

    // Successfully authenticated!
    const sessionToken = authData.Token;
    const serverUrl = authData.Server;

    console.log("Authentication successful!");
    console.log("Server URL:", serverUrl);
    console.log("Session token (first 5 chars):", sessionToken.substring(0, 5) + "...");

    // Step 2: Call the GetViewStats endpoint
    const viewStatsUrl = `${serverUrl}/api/OpenOrders/GetViewStats`;
    console.log("Making API call to:", viewStatsUrl);

    // Prepare the request body based on the API documentation
    const request = {
      // Default values
      RebuildCacheIfRequired: true,
      RecalculateViewIfRequired: true,
      OnlyVisible: true
      // You may add LocationId or ViewId if needed
    };

    const viewStatsResponse = await fetch(viewStatsUrl, {
      method: 'POST',
      headers: {
        'Authorization': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request)
    });

    console.log("ViewStats API call response status:", viewStatsResponse.status);

    if (!viewStatsResponse.ok) {
      const apiErrorText = await viewStatsResponse.text();
      return json({
        success: false,
        error: `ViewStats API call failed: ${viewStatsResponse.status}: ${apiErrorText}`,
        request: request
      }, { status: 500 });
    }

    const viewStatsData = await viewStatsResponse.json();

    return json({
      success: true,
      message: "Successfully retrieved order view stats from Linnworks API!",
      auth: {
        server: serverUrl,
        tokenFirstChars: sessionToken.substring(0, 5) + "..."
      },
      viewStatsData: viewStatsData
    });
  } catch (error) {
    console.error("ViewStats API test error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}