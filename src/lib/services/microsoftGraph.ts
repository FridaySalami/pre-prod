import { PublicClientApplication, type Configuration, type AuthenticationResult } from '@azure/msal-browser';
import { browser } from '$app/environment';

// Microsoft Graph configuration
const msalConfig: Configuration = {
	auth: {
		clientId: '9046537c-b24f-4648-8737-1bc37f5833b6', // Your Azure app client ID
		authority: 'https://login.microsoftonline.com/51192ec3-cc16-4231-9f5f-e75ca9d12724', // Fixed authority URL
		redirectUri: browser ? window.location.origin + '/pricer' : 'http://localhost:5173/pricer' // Handle SSR
	},
	cache: {
		cacheLocation: 'localStorage',
		storeAuthStateInCookie: false
	}
};

// Required Graph API scopes for Excel
const graphScopes = [
	'https://graph.microsoft.com/Files.ReadWrite',
	'https://graph.microsoft.com/Sites.ReadWrite.All'
];

class MicrosoftGraphService {
	private msalInstance: PublicClientApplication | null = null;
	private accessToken: string | null = null;

	constructor() {
		// Only initialize MSAL in the browser
		if (browser) {
			this.msalInstance = new PublicClientApplication(msalConfig);
		}
	}

	// Initialize MSAL
	async initialize(): Promise<void> {
		if (!browser || !this.msalInstance) {
			console.warn('Microsoft Graph service not available in SSR mode');
			return;
		}
		await this.msalInstance.initialize();
	}

	// Login user
	async login(): Promise<AuthenticationResult> {
		if (!browser || !this.msalInstance) {
			throw new Error('Microsoft Graph service not available in SSR mode');
		}

		try {
			const loginResponse = await this.msalInstance.loginPopup({
				scopes: graphScopes
			});
			this.accessToken = loginResponse.accessToken;
			return loginResponse;
		} catch (error) {
			console.error('Login failed:', error);
			throw error;
		}
	}

	// Get access token silently
	async getAccessToken(): Promise<string> {
		if (!browser || !this.msalInstance) {
			throw new Error('Microsoft Graph service not available in SSR mode');
		}

		if (this.accessToken) {
			return this.accessToken;
		}

		try {
			const accounts = this.msalInstance.getAllAccounts();
			if (accounts.length === 0) {
				throw new Error('No accounts found. Please login first.');
			}

			const silentRequest = {
				scopes: graphScopes,
				account: accounts[0]
			};

			const response = await this.msalInstance.acquireTokenSilent(silentRequest);
			this.accessToken = response.accessToken;
			return this.accessToken;
		} catch (error) {
			console.error('Silent token acquisition failed:', error);
			// Fallback to interactive login
			const loginResponse = await this.login();
			return loginResponse.accessToken;
		}
	}

	// Logout user
	async logout(): Promise<void> {
		if (!browser || !this.msalInstance) {
			return;
		}
		await this.msalInstance.logoutPopup();
		this.accessToken = null;
	}

	// Check if user is logged in
	isLoggedIn(): boolean {
		if (!browser || !this.msalInstance) {
			return false;
		}
		const accounts = this.msalInstance.getAllAccounts();
		return accounts.length > 0;
	}

	// Get current user account
	getCurrentAccount() {
		if (!browser || !this.msalInstance) {
			return null;
		}
		const accounts = this.msalInstance.getAllAccounts();
		return accounts.length > 0 ? accounts[0] : null;
	}
}

export const graphService = new MicrosoftGraphService();
