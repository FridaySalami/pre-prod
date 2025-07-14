import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, AMAZON_REFRESH_TOKEN, AMAZON_AWS_ACCESS_KEY_ID, AMAZON_AWS_SECRET_ACCESS_KEY } from '$env/static/private';

interface DiagnosticResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
  recommendation?: string;
}

interface DiagnosticReport {
  timestamp: string;
  overallStatus: 'healthy' | 'issues' | 'critical';
  summary: string;
  environment: DiagnosticResult;
  oauth: DiagnosticResult;
  aws: DiagnosticResult;
  endpoints: {
    orders: DiagnosticResult;
    pricing: DiagnosticResult;
    inventory: DiagnosticResult;
    listings: DiagnosticResult;
  };
  recommendations: string[];
}

async function testEnvironmentVariables(): Promise<DiagnosticResult> {
  const required = {
    AMAZON_CLIENT_ID,
    AMAZON_CLIENT_SECRET,
    AMAZON_REFRESH_TOKEN,
    AMAZON_AWS_ACCESS_KEY_ID,
    AMAZON_AWS_SECRET_ACCESS_KEY
  };

  const missing = Object.entries(required).filter(([_, value]) => !value);

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `Missing required environment variables: ${missing.map(([key]) => key).join(', ')}`,
      recommendation: 'Check your .env file and ensure all required Amazon and AWS credentials are present'
    };
  }

  // Check if credentials look valid
  const issues = [];
  if (!AMAZON_CLIENT_ID?.startsWith('amzn1.application-oa2-client.')) {
    issues.push('AMAZON_CLIENT_ID format appears invalid');
  }
  if (AMAZON_REFRESH_TOKEN && !AMAZON_REFRESH_TOKEN.startsWith('Atzr|')) {
    issues.push('AMAZON_REFRESH_TOKEN format appears invalid');
  }
  if (AMAZON_AWS_ACCESS_KEY_ID && AMAZON_AWS_ACCESS_KEY_ID.length !== 20) {
    issues.push('AMAZON_AWS_ACCESS_KEY_ID length appears invalid');
  }

  if (issues.length > 0) {
    return {
      status: 'warning',
      message: `Environment variables present but may have format issues: ${issues.join(', ')}`,
      recommendation: 'Verify your credentials are copied correctly from Amazon Developer Console and AWS IAM'
    };
  }

  return {
    status: 'pass',
    message: 'All required environment variables are present and appear valid',
    details: {
      amazonClientId: AMAZON_CLIENT_ID?.substring(0, 20) + '...',
      hasRefreshToken: !!AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: AMAZON_AWS_ACCESS_KEY_ID?.substring(0, 10) + '...'
    }
  };
}

async function testOAuthAndTokenExchange(): Promise<DiagnosticResult> {
  try {
    if (!AMAZON_REFRESH_TOKEN) {
      return {
        status: 'fail',
        message: 'No refresh token available',
        recommendation: 'Complete OAuth authorization flow first by visiting /api/amazon/oauth/authorize'
      };
    }

    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: AMAZON_REFRESH_TOKEN,
        client_id: AMAZON_CLIENT_ID,
        client_secret: AMAZON_CLIENT_SECRET
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return {
        status: 'fail',
        message: `Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`,
        details: { error: errorText },
        recommendation: 'Check your Amazon client credentials and refresh token. May need to re-authorize.'
      };
    }

    const tokenData = await tokenResponse.json();

    return {
      status: 'pass',
      message: 'OAuth token exchange successful',
      details: {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope
      }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `OAuth test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendation: 'Check network connectivity and Amazon LWA service status'
    };
  }
}

async function testAWSCredentials(): Promise<DiagnosticResult> {
  try {
    // Test AWS credentials by making a simple STS call
    const crypto = await import('crypto');

    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    const region = 'us-east-1';
    const service = 'sts';

    const host = `${service}.${region}.amazonaws.com`;
    const method = 'GET';
    const uri = '/';
    const querystring = 'Action=GetCallerIdentity&Version=2011-06-15';

    // Create signature
    const canonical_request = `${method}\n${uri}\n${querystring}\nhost:${host}\nx-amz-date:${timestamp}\n\nhost;x-amz-date\n${crypto.createHash('sha256').update('').digest('hex')}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credential_scope = `${date}/${region}/${service}/aws4_request`;
    const string_to_sign = `${algorithm}\n${timestamp}\n${credential_scope}\n${crypto.createHash('sha256').update(canonical_request).digest('hex')}`;

    const kDate = crypto.createHmac('sha256', 'AWS4' + AMAZON_AWS_SECRET_ACCESS_KEY).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(string_to_sign).digest('hex');

    const authorization = `${algorithm} Credential=${AMAZON_AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=host;x-amz-date, Signature=${signature}`;

    const response = await fetch(`https://${host}/?${querystring}`, {
      method: 'GET',
      headers: {
        'Host': host,
        'X-Amz-Date': timestamp,
        'Authorization': authorization
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: 'fail',
        message: `AWS credentials test failed: ${response.status} ${response.statusText}`,
        details: { error: errorText },
        recommendation: 'Check your AWS access key and secret key. Ensure the IAM user exists and has basic permissions.'
      };
    }

    const responseText = await response.text();
    const userIdMatch = responseText.match(/<UserId>([^<]+)<\/UserId>/);
    const arnMatch = responseText.match(/<Arn>([^<]+)<\/Arn>/);

    return {
      status: 'pass',
      message: 'AWS credentials are valid',
      details: {
        userId: userIdMatch?.[1],
        arn: arnMatch?.[1]
      }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `AWS credentials test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendation: 'Check your AWS credentials and network connectivity'
    };
  }
}

async function testSpApiEndpoint(endpoint: string, accessToken: string): Promise<DiagnosticResult> {
  try {
    const crypto = await import('crypto');

    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    const region = 'eu-west-1';
    const service = 'execute-api';

    const host = `sellingpartnerapi-eu.amazon.com`;
    const method = 'GET';
    const uri = endpoint;
    const querystring = '';

    // Create signature
    const canonical_request = `${method}\n${uri}\n${querystring}\nhost:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${timestamp}\n\nhost;x-amz-access-token;x-amz-date\n${crypto.createHash('sha256').update('').digest('hex')}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credential_scope = `${date}/${region}/${service}/aws4_request`;
    const string_to_sign = `${algorithm}\n${timestamp}\n${credential_scope}\n${crypto.createHash('sha256').update(canonical_request).digest('hex')}`;

    const kDate = crypto.createHmac('sha256', 'AWS4' + AMAZON_AWS_SECRET_ACCESS_KEY).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(string_to_sign).digest('hex');

    const authorization = `${algorithm} Credential=${AMAZON_AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=host;x-amz-access-token;x-amz-date, Signature=${signature}`;

    const response = await fetch(`https://${host}${endpoint}`, {
      method: 'GET',
      headers: {
        'Host': host,
        'Authorization': authorization,
        'x-amz-access-token': accessToken,
        'x-amz-date': timestamp
      }
    });

    const responseText = await response.text();

    if (response.status === 403) {
      return {
        status: 'fail',
        message: `Access denied (403) for ${endpoint}`,
        details: {
          status: response.status,
          error: responseText
        },
        recommendation: 'Check AWS IAM permissions and Amazon Developer Console API permissions'
      };
    }

    if (response.status === 404) {
      return {
        status: 'warning',
        message: `Endpoint accessible but no data found (404) for ${endpoint}`,
        details: {
          status: response.status,
          response: responseText
        },
        recommendation: 'Endpoint is accessible but may need different parameters or test data'
      };
    }

    if (!response.ok) {
      return {
        status: 'fail',
        message: `API call failed with status ${response.status}`,
        details: {
          status: response.status,
          error: responseText
        },
        recommendation: 'Check API endpoint URL and request parameters'
      };
    }

    return {
      status: 'pass',
      message: `Successfully accessed ${endpoint}`,
      details: {
        status: response.status,
        dataReceived: responseText.length > 0
      }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Endpoint test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendation: 'Check network connectivity and endpoint URL'
    };
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    overallStatus: 'healthy',
    summary: '',
    environment: await testEnvironmentVariables(),
    oauth: { status: 'fail', message: 'Not tested' },
    aws: { status: 'fail', message: 'Not tested' },
    endpoints: {
      orders: { status: 'fail', message: 'Not tested' },
      pricing: { status: 'fail', message: 'Not tested' },
      inventory: { status: 'fail', message: 'Not tested' },
      listings: { status: 'fail', message: 'Not tested' }
    },
    recommendations: []
  };

  // If environment check fails, stop here
  if (report.environment.status === 'fail') {
    report.overallStatus = 'critical';
    report.summary = 'Critical environment configuration issues detected';
    report.recommendations.push('Fix environment variables before proceeding');
    return json(report);
  }

  // Test OAuth
  report.oauth = await testOAuthAndTokenExchange();

  // Test AWS credentials
  report.aws = await testAWSCredentials();

  // If we have a valid access token, test endpoints
  if (report.oauth.status === 'pass' && report.oauth.details?.access_token) {
    const accessToken = report.oauth.details.access_token;

    // Test different endpoints
    report.endpoints.orders = await testSpApiEndpoint('/orders/v0/orders?MarketplaceIds=A1F83G8C2ARO7P&CreatedAfter=2024-01-01T00:00:00Z', accessToken);
    report.endpoints.pricing = await testSpApiEndpoint('/products/pricing/v0/price?MarketplaceId=A1F83G8C2ARO7P&Skus=TEST-SKU-123', accessToken);
    report.endpoints.inventory = await testSpApiEndpoint('/fba/inventory/v1/summaries?granularityType=Marketplace&granularityId=A1F83G8C2ARO7P&marketplaceIds=A1F83G8C2ARO7P', accessToken);
    report.endpoints.listings = await testSpApiEndpoint('/listings/2021-08-01/items?marketplaceIds=A1F83G8C2ARO7P&pageSize=10', accessToken);
  } else if (report.oauth.status === 'pass') {
    // Get fresh access token
    try {
      const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: AMAZON_REFRESH_TOKEN,
          client_id: AMAZON_CLIENT_ID,
          client_secret: AMAZON_CLIENT_SECRET
        })
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Update the oauth details with the access token
        report.oauth.details = { ...report.oauth.details, access_token: accessToken };

        // Test endpoints with fresh token
        report.endpoints.orders = await testSpApiEndpoint('/orders/v0/orders?MarketplaceIds=A1F83G8C2ARO7P&CreatedAfter=2024-01-01T00:00:00Z', accessToken);
        report.endpoints.pricing = await testSpApiEndpoint('/products/pricing/v0/price?MarketplaceId=A1F83G8C2ARO7P&Skus=TEST-SKU-123', accessToken);
        report.endpoints.inventory = await testSpApiEndpoint('/fba/inventory/v1/summaries?granularityType=Marketplace&granularityId=A1F83G8C2ARO7P&marketplaceIds=A1F83G8C2ARO7P', accessToken);
        report.endpoints.listings = await testSpApiEndpoint('/listings/2021-08-01/items?marketplaceIds=A1F83G8C2ARO7P&pageSize=10', accessToken);
      }
    } catch (error) {
      // Token exchange failed, endpoint tests will remain as 'Not tested'
    }
  }

  // Determine overall status
  const allResults = [
    report.environment,
    report.oauth,
    report.aws,
    ...Object.values(report.endpoints)
  ];

  const criticalIssues = allResults.filter(r => r.status === 'fail').length;
  const warnings = allResults.filter(r => r.status === 'warning').length;

  if (criticalIssues > 0) {
    report.overallStatus = 'critical';
    report.summary = `${criticalIssues} critical issues detected`;
  } else if (warnings > 0) {
    report.overallStatus = 'issues';
    report.summary = `${warnings} warnings detected`;
  } else {
    report.overallStatus = 'healthy';
    report.summary = 'All systems operational';
  }

  // Generate recommendations
  report.recommendations = [];

  if (['fail', 'warning'].includes(report.environment.status)) {
    report.recommendations.push('Fix environment variable configuration');
  }

  if ('fail' === report.oauth.status) {
    report.recommendations.push('Complete OAuth authorization flow');
  }

  if ('fail' === report.aws.status) {
    report.recommendations.push('Verify AWS credentials and IAM user permissions');
  }

  const endpointIssues = Object.values(report.endpoints).filter(e => e.status === 'fail').length;
  if (endpointIssues > 0) {
    report.recommendations.push('Update Amazon Developer Console permissions and AWS IAM policy');
    report.recommendations.push('Wait 5-10 minutes for AWS IAM policy changes to propagate');
  }

  // Add specific recommendations from individual tests
  allResults.forEach(result => {
    if (result.recommendation && !report.recommendations.includes(result.recommendation)) {
      report.recommendations.push(result.recommendation);
    }
  });

  return json(report);
};
