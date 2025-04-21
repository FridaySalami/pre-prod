import { json } from '@sveltejs/kit';

// Use inline values just for direct testing
// REMOVE THESE AFTER TESTING!
const APP_ID = "9a5d43c3-509f-443a-8a4a-264dc7332f1b";
const APP_SECRET = "492e20f8-f42f-4ce9-abe2-911e19054ae9";

export async function GET() {
  try {
    console.log("Testing direct Linnworks auth with hardcoded credentials");
    
    // Use URLSearchParams properly
    const params = new URLSearchParams();
    params.append('applicationId', APP_ID);
    params.append('applicationSecret', APP_SECRET);
    
    const response = await fetch('https://api.linnworks.net/api/Auth/AuthorizeByApplication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Auth failed with status:", response.status);
      console.error("Error response:", errorText);
      return json({ success: false, error: errorText }, { status: 500 });
    }
    
    const data = await response.json();
    return json({ 
      success: true, 
      hasToken: !!data.Token,
      expires: data.TTL,
      server: data.Server
    });
  } catch (error) {
    console.error("Test auth error:", error);
    return json({ 
      success: false, 
      error: String(error)
    }, { status: 500 });
  }
}