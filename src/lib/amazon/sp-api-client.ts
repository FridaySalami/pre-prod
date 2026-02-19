/**
 * Amazon SP-API Client
 * 
 * Reusable client for all Amazon Selling Partner API integrations
 * Handles authentication, request signing, rate limiting, and error handling
 */

import crypto from 'crypto';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import type {
  SPAPIConfig,
  SPAPICredentials,
  LWATokenResponse,
  SPAPIResponse,
  RateLimitError
} from './types';
import { RateLimiters, type RateLimiterConfig, RateLimiter } from './rate-limiter';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface AssumedCreds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

export class SPAPIClient {
  private config: SPAPIConfig;
  private tokenCache: TokenCache | null = null;
  private stsCredsCache: AssumedCreds | null = null;

  // Use global LWA token endpoint (works for all regions)
  private readonly LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

  // Regional SP-API endpoints
  private readonly REGIONAL_ENDPOINTS: Record<string, string> = {
    'eu-west-1': 'https://sellingpartnerapi-eu.amazon.com',
    'us-east-1': 'https://sellingpartnerapi-na.amazon.com',
    'us-west-2': 'https://sellingpartnerapi-fe.amazon.com'
  }; constructor(config: SPAPIConfig) {
    this.config = {
      awsRegion: 'eu-west-1',
      marketplaceId: 'A1F83G8C2ARO7P', // UK default
      ...config
    };

    // Validate required credentials
    this.validateCredentials();
  }

  /**
   * Validate that all required credentials are present
   */
  private validateCredentials(): void {
    const required = [
      'clientId',
      'clientSecret',
      'refreshToken',
      'awsAccessKeyId',
      'awsSecretAccessKey'
    ];

    const missing = required.filter(key => !this.config[key as keyof SPAPIConfig]);

    if (missing.length > 0) {
      throw new Error(`Missing required credentials: ${missing.join(', ')}`);
    }
  }

  /**
   * Get access token (cached or refreshed)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 300000) {
      return this.tokenCache.accessToken;
    }

    // Refresh token using global LWA endpoint
    // Logging credential lengths to debug invalid_client error
    console.log('SP-API Auth Debug:', {
      clientIdLen: this.config.clientId?.length,
      clientSecretLen: this.config.clientSecret?.length,
      refreshTokenLen: this.config.refreshToken?.length,
      clientIdStart: this.config.clientId?.substring(0, 5),
      clientSecretStart: this.config.clientSecret?.substring(0, 5)
    });

    const response = await fetch(this.LWA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken?.trim(),
        client_id: this.config.clientId?.trim(),
        client_secret: this.config.clientSecret?.trim()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh access token: ${response.status} ${errorText}`);
    }

    const data: LWATokenResponse = await response.json();

    // Cache the token
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };

    return data.access_token;
  }

  /**
   * Assume SP-API Role via STS and cache temporary credentials
   * Credentials are cached for 50-55 minutes (refresh before 1 hour expiration)
   * 
   * CRITICAL: Uses Seller Partner ID as External ID for security
   */
  private async assumeRole(): Promise<AssumedCreds> {
    // Return cached credentials if still valid (with 5-10 min buffer)
    const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
    if (this.stsCredsCache && this.stsCredsCache.expiration.getTime() > Date.now() + bufferMs) {
      return this.stsCredsCache;
    }

    const roleArn = this.config.roleArn || process.env.AMAZON_ROLE_ARN;
    if (!roleArn) {
      throw new Error('Missing roleArn in config or AMAZON_ROLE_ARN environment variable for STS AssumeRole');
    }

    // Get Seller Partner ID for External ID (required by Amazon SP-API for security)
    const sellerId = this.config.sellerId || process.env.AMAZON_SELLER_ID;
    if (!sellerId) {
      throw new Error('Missing Seller ID (sellerId in config or AMAZON_SELLER_ID env var) for STS AssumeRole External ID');
    }

    // Create STS client with base IAM user credentials
    const sts = new STSClient({
      region: this.config.awsRegion,
      credentials: {
        accessKeyId: this.config.awsAccessKeyId!.trim(),
        secretAccessKey: this.config.awsSecretAccessKey!.trim()
      }
    });

    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `spapi-${Date.now()}`,
      DurationSeconds: 3600, // 1 hour (maximum for many roles)
      ExternalId: sellerId // CRITICAL: Seller Partner ID as External ID
    });

    const response = await sts.send(command);

    if (!response.Credentials) {
      throw new Error('AssumeRole failed: no credentials returned from STS');
    }

    // Cache the temporary credentials
    this.stsCredsCache = {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
      expiration: response.Credentials.Expiration!
    };

    return this.stsCredsCache;
  }

  /**
   * Get AWS credentials - always uses STS AssumeRole for temporary credentials
   */
  private async getAwsCreds(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }> {
    // Always assume the SP-API role to get temporary credentials
    const creds = await this.assumeRole();

    return {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken
    };
  }

  /**
   * Build canonical query string for AWS SigV4
   * Must be sorted by key, then by value, with RFC3986 encoding
   */
  private buildCanonicalQueryString(params: URLSearchParams): string {
    const pairs: string[] = [];
    // Collect and sort keys
    const keys = Array.from(new Set(Array.from(params.keys()))).sort();
    for (const k of keys) {
      const values = params.getAll(k).sort();
      for (const v of values) {
        // RFC3986 encode (encodeURIComponent, then fix specific chars)
        const encK = encodeURIComponent(k).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        const encV = encodeURIComponent(v).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        pairs.push(`${encK}=${encV}`);
      }
    }
    return pairs.join('&');
  }

  /**
   * Sign AWS request with SigV4
   * Always uses temporary STS credentials with session token
   */
  private async signRequest(
    method: string,
    path: string,
    queryParams: URLSearchParams,
    headers: Record<string, string>,
    body?: string
  ): Promise<Record<string, string>> {
    const region = this.config.awsRegion!;
    const service = 'execute-api';
    const host = this.REGIONAL_ENDPOINTS[region]?.replace('https://', '') || '';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // Get temporary AWS credentials via STS AssumeRole
    const { accessKeyId, secretAccessKey, sessionToken } = await this.getAwsCreds();

    // Add session token (always present) and User-Agent before canonicalization
    headers['x-amz-security-token'] = sessionToken;
    if (!headers['User-Agent']) {
      headers['User-Agent'] = 'ParkersApp/1.0 (Language=TypeScript; Platform=Node.js; contact=jack.w@parkersfoodservice.co.uk)';
    }

    // Canonical request components
    const canonicalUri = path;
    const canonicalQueryString = this.buildCanonicalQueryString(queryParams);

    // Build canonical headers - always include session token (from STS)
    const canonicalHeadersLines = [
      `host:${host}`,
      `x-amz-date:${amzDate}`,
      `x-amz-security-token:${headers['x-amz-security-token']}`
    ];

    const canonicalHeaders = canonicalHeadersLines.join('\n') + '\n';

    // Build signed headers list - always include session token
    const signedHeaders = 'host;x-amz-date;x-amz-security-token';

    const payloadHash = crypto.createHash('sha256').update(body || '').digest('hex');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // String to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Derive signing key using the credentials (supports temporary STS keys)
    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Authorization header
    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'host': host,
      'x-amz-date': amzDate,
      'Authorization': authorizationHeader
    };
  }  /**
   * Make an SP-API request with automatic retry and rate limiting
   */
  async request<T = any>(
    method: string,
    path: string,
    options: {
      queryParams?: Record<string, string>;
      body?: any;
      headers?: Record<string, string>;
      rateLimiter?: RateLimiter;
      retries?: number;
    } = {}
  ): Promise<SPAPIResponse<T>> {
    const {
      queryParams = {},
      body,
      headers = {},
      rateLimiter = RateLimiters.default,
      retries = 3
    } = options;

    const endpoint = this.REGIONAL_ENDPOINTS[this.config.awsRegion!];
    if (!endpoint) {
      throw new Error(`Invalid AWS region: ${this.config.awsRegion}`);
    }

    const accessToken = await this.getAccessToken();
    const queryParamObj = new URLSearchParams(queryParams);
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const requestHeaders: Record<string, string> = {
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
      ...headers
    };

    // Sign the request (now async to support STS credentials)
    const signedHeaders = await this.signRequest(
      method,
      path,
      queryParamObj,
      requestHeaders,
      bodyStr
    );

    // Use the same canonical query string for both signing and URL
    const canonicalQueryString = this.buildCanonicalQueryString(queryParamObj);
    const url = `${endpoint}${path}${canonicalQueryString ? '?' + canonicalQueryString : ''}`;

    // Execute request through rate limiter
    const executeRequest = async (): Promise<SPAPIResponse<T>> => {
      const response = await fetch(url, {
        method,
        headers: signedHeaders,
        body: bodyStr
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        const error = new Error(`Rate limit exceeded`) as RateLimitError;
        error.retryAfter = retryAfter;
        error.headers = responseHeaders;
        throw error;
      }

      // Handle other errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        return {
          success: false,
          errors: Array.isArray(errorData.errors) ? errorData.errors : [
            {
              code: `HTTP_${response.status}`,
              message: errorData.message || errorText
            }
          ],
          statusCode: response.status,
          headers: responseHeaders
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
        headers: responseHeaders,
        statusCode: response.status
      };
    };

    // Retry logic with exponential backoff
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await rateLimiter.schedule(executeRequest);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof Error &&
          (error.message.includes('Unauthorized') ||
            error.message.includes('InvalidInput'))) {
          throw error;
        }

        // Handle rate limit errors with backoff
        if ((error as RateLimitError).retryAfter) {
          const retryAfter = (error as RateLimitError).retryAfter! * 1000;
          console.log(`Rate limited, retrying after ${retryAfter}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          continue;
        }

        // Exponential backoff for other errors
        if (attempt < retries - 1) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`Request failed, retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Convenience methods for different HTTP verbs
   */
  async get<T = any>(path: string, options?: Parameters<typeof this.request>[2]) {
    return this.request<T>('GET', path, options);
  }

  async post<T = any>(path: string, body?: any, options?: Parameters<typeof this.request>[2]) {
    return this.request<T>('POST', path, { ...options, body });
  }

  async put<T = any>(path: string, body?: any, options?: Parameters<typeof this.request>[2]) {
    return this.request<T>('PUT', path, { ...options, body });
  }

  async delete<T = any>(path: string, options?: Parameters<typeof this.request>[2]) {
    return this.request<T>('DELETE', path, options);
  }

  /**
   * Create a new SP-API client from environment variables
   */
  static fromEnv(overrides?: Partial<SPAPICredentials>): SPAPIClient {
    return new SPAPIClient({
      clientId: process.env.AMAZON_CLIENT_ID || '',
      clientSecret: process.env.AMAZON_CLIENT_SECRET || '',
      refreshToken: process.env.AMAZON_REFRESH_TOKEN || '',
      awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID || '',
      awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY || '',
      awsRegion: process.env.AMAZON_AWS_REGION || 'eu-west-1',
      marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      ...overrides
    });
  }
}
