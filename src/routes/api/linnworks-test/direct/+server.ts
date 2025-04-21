import { json } from '@sveltejs/kit';
import * as env from '$env/static/private';

// Add POST handler to match GET
export const POST = GET;

// Original GET handler
export async function GET() {
  try {
    // If you already have a direct token (not requiring auth)
    const accessToken = env.LINNWORKS_ACCESS_TOKEN;
    
    if (!accessToken) {
      return json({
        success: false,
        error: "No access token available"
      }, { status: 500 });
    }
    
    console.log("Verifying access token first...");
    
    // Step 1: Verify the token and get a session token
    console.log("Request details:", {
      method: 'POST',
      url: 'https://api.linnworks.net/api/Auth/AuthorizeToken',
      body: JSON.stringify({ token: accessToken.substring(0, 4) + '...' }) // Show only first 4 chars
    });

    const authResponse = await fetch('https://api.linnworks.net/api/Auth/AuthorizeToken', {
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
        error: `Auth Error ${authResponse.status}: ${errorText}`
      }, { status: 500 });
    }
    
    // Trying to log any response data we can get
    try {
      const clonedResponse = authResponse.clone();
      const bodyText = await clonedResponse.text();
      console.log("Response body:", bodyText);
    } catch (e) {
      console.log("Couldn't clone response:", e);
    }

    // Parse the auth response to get the session token and server URL
    const authData = await authResponse.json();
    
    if (!authData.Token || !authData.Server) {
      return json({
        success: false,
        error: "Missing Token or Server in auth response",
        authData
      }, { status: 500 });
    }
    
    console.log("Authentication successful!");
    console.log("Server:", authData.Server);
    console.log("Session token acquired (first 5 chars):", authData.Token.substring(0, 5) + "...");
    
    // Step 2: Use the session token to call an API endpoint
    const serverUrl = authData.Server;
    const sessionToken = authData.Token;
    
    const apiResponse = await fetch(`${serverUrl}/api/Inventory/GetInventoryItems`, {
      method: 'POST',
      headers: {
        'Authorization': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "view": {
          "columns": ["StockItemID", "ItemNumber", "ItemTitle"],
          "stockLocationIds": [],
          "additionalFilters": []
        },
        "entriesPerPage": 10,
        "pageNumber": 1
      })
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return json({
        success: false,
        error: `API Error ${apiResponse.status}: ${errorText}`,
        serverUsed: serverUrl,
        tokenFirstChars: sessionToken.substring(0, 5) + "..."
      }, { status: 500 });
    }
    
    const apiData = await apiResponse.json();
    
    return json({
      success: true,
      server: serverUrl,
      data: apiData
    });
  } catch (error) {
    console.error('Direct API call failed:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}