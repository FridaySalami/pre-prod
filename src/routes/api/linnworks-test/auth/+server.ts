import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function GET() {
  try {
    console.log("Testing Linnworks authentication with correct flow...");

    // Get the application credentials
    const applicationId = env.LINNWORKS_APP_ID;
    const applicationSecret = env.LINNWORKS_APP_SECRET;

    // Get the access token - THIS IS WHAT WE'RE MISSING
    // This should be provided to you when a user installs your app
    // For testing, you should have this from the Linnworks installation process
    const accessToken = env.LINNWORKS_ACCESS_TOKEN;

    if (!accessToken) {
      console.error("Missing access token - this is required according to the docs");
      return json({
        success: false,
        error: "Missing access token. You need to generate an access token by installing the app.",
        documentation: "See the Linnworks developer portal to generate an access token first"
      }, { status: 500 });
    }

    console.log("Making auth request with all three required parameters...");

    // Correct authentication request with all three parameters
    const response = await fetch('https://api.linnworks.net/api/Auth/AuthorizeByApplication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        'applicationId': applicationId,
        'applicationSecret': applicationSecret,
        'token': accessToken // Adding the missing access token parameter
      })
    });

    console.log("Response status:", response.status);

    const responseText = await response.text();
    console.log("Response text:", responseText);

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log("Parsed JSON response:", data);
    } catch (parseErr) {
      console.error("Failed to parse response as JSON:", parseErr);
      return json({
        success: false,
        error: "Failed to parse API response as JSON",
        responseText
      }, { status: 500 });
    }

    if (!response.ok) {
      console.error("API error:", response.status, data);
      return json({
        success: false,
        error: `API error ${response.status}: ${JSON.stringify(data)}`,
        responseStatus: response.status,
        missingAccessToken: !accessToken
      }, { status: 500 });
    }

    // Check if we have a token and server in the response
    if (!data.Token || !data.Server) {
      return json({
        success: false,
        error: "Missing Token or Server in response",
        data
      }, { status: 500 });
    }

    console.log("Authentication successful!");
    console.log("Server:", data.Server);

    // Return success
    return json({
      success: true,
      hasToken: true,
      server: data.Server,
      tokenFirstChars: data.Token.substring(0, 5) + '...',
      expires: data.TTL || 3600,
      message: "Successfully authenticated with Linnworks!"
    });
  } catch (error) {
    console.error('Linnworks auth test failed:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}