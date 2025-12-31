import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const POST = GET;

export async function GET() {
  try {
    console.log("Testing Linnworks authentication with correct parameter names...");

    const applicationId = env.LINNWORKS_APP_ID;
    const applicationSecret = env.LINNWORKS_APP_SECRET;
    const accessToken = env.LINNWORKS_ACCESS_TOKEN;

    if (!applicationId || !applicationSecret || !accessToken) {
      return json({
        success: false,
        error: "Missing required credentials",
        missingAppId: !applicationId,
        missingAppSecret: !applicationSecret,
        missingAccessToken: !accessToken
      }, { status: 500 });
    }

    console.log("Proper JSON authentication with correct case...");

    const response = await fetch('https://api.linnworks.net/api/Auth/AuthorizeByApplication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Notice the capitalization here - matches exactly what's in the Swagger doc
      body: JSON.stringify({
        "ApplicationId": applicationId,
        "ApplicationSecret": applicationSecret,
        "Token": accessToken
      })
    });

    console.log("Authentication response status:", response.status);

    const responseText = await response.text();
    console.log("Response text:", responseText);

    if (!response.ok) {
      return json({
        success: false,
        error: `Authentication failed: ${response.status}: ${responseText}`
      }, { status: 500 });
    }

    try {
      const authData = JSON.parse(responseText);

      // Check key properties
      if (!authData.Token || !authData.Server) {
        return json({
          success: false,
          error: "Missing Token or Server in response",
          authResponse: authData
        }, { status: 500 });
      }

      // Successfully authenticated!
      // Now we can use the session token and server URL
      const sessionToken = authData.Token;
      const serverUrl = authData.Server;

      console.log("Authentication successful!");
      console.log("Server URL:", serverUrl);
      console.log("User ID:", authData.Id);
      console.log("Session token (first 5 chars):", sessionToken.substring(0, 5) + "...");

      // Try to make an API call using the session
      const apiUrl = `${serverUrl}/api/Dashboards/GetTopProducts`;
      console.log("Making API call to:", apiUrl);

      const apiResponse = await fetch(`${apiUrl}?type=GroupedByQuantity&period=1&numRows=5&orderStatus=3`, {
        method: 'GET',
        headers: {
          'Authorization': sessionToken,
          'Accept': 'application/json'
        }
      });

      console.log("API call response status:", apiResponse.status);

      if (!apiResponse.ok) {
        const apiErrorText = await apiResponse.text();
        return json({
          success: false,
          authenticated: true,
          error: `API call failed: ${apiResponse.status}: ${apiErrorText}`,
          sessionToken: sessionToken.substring(0, 5) + "...",
          serverUrl
        }, { status: 500 });
      }

      const apiData = await apiResponse.json();

      return json({
        success: true,
        message: "Successfully authenticated and called Linnworks API!",
        auth: {
          server: serverUrl,
          tokenFirstChars: sessionToken.substring(0, 5) + "..."
        },
        apiData
      });
    } catch (parseErr) {
      return json({
        success: false,
        error: `Failed to parse authentication response as JSON: ${parseErr}`,
        responseText
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Authentication test error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}