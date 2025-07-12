<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let loading = false;
	let authData: any = null;
	let error: string | null = null;
	let currentOrigin = '';

	async function initiateOAuth() {
		loading = true;
		error = null;

		try {
			const response = await fetch('/api/amazon/oauth/authorize');
			const data = await response.json();

			if (data.success) {
				authData = data;
				// Automatically open the authorization URL
				window.open(data.authUrl, '_blank');
			} else {
				error = data.errorDescription || 'Failed to initiate OAuth';
			}
		} catch (err) {
			error = 'Network error occurred';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		// Only run client-side code when in browser
		if (browser) {
			// Set the current origin for the redirect URI display
			currentOrigin = window.location.origin;

			// Check if we're returning from OAuth callback
			const urlParams = new URLSearchParams(window.location.search);
			const code = urlParams.get('code');
			const oauthError = urlParams.get('error');

			if (code) {
				// We have an authorization code, show success
				authData = { success: true, code: code };
			} else if (oauthError) {
				error = `OAuth error: ${oauthError}`;
			}
		}
	});
</script>

<svelte:head>
	<title>Amazon SP-API OAuth Setup</title>
</svelte:head>

<div class="container">
	<div class="content">
		<div class="header">
			<h1>Amazon SP-API OAuth Setup</h1>
			<p class="subtitle">
				Complete the OAuth flow to get your refresh token for Amazon SP-API integration
			</p>
		</div>

		{#if error}
			<div class="alert error">
				<strong>Error:</strong>
				{error}
			</div>
		{/if}

		<div class="card">
			<div class="card-header">
				<h2>Step 1: Prerequisites</h2>
				<p class="card-description">Make sure you have completed these steps before proceeding:</p>
			</div>
			<div class="card-content">
				<div class="checklist">
					<div class="checklist-item">
						<span class="badge">✓</span>
						<span>Registered your application in Amazon Developer Console</span>
					</div>
					<div class="checklist-item">
						<span class="badge">✓</span>
						<span>Added your Client ID and Client Secret to .env file</span>
					</div>
					<div class="checklist-item">
						<span class="badge">✓</span>
						<span>Created AWS IAM user with SP-API permissions</span>
					</div>
					<div class="checklist-item">
						<span class="badge">✓</span>
						<span>Added the redirect URI to your Amazon app configuration</span>
					</div>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header">
				<h2>Step 2: Redirect URI Configuration</h2>
				<p class="card-description">
					Add this redirect URI to your Amazon Developer Console app configuration:
				</p>
			</div>
			<div class="card-content">
				<div class="code-block">
					{currentOrigin || 'http://localhost:3001'}/api/amazon/oauth/callback
				</div>
				<p class="help-text">
					Go to your Amazon Developer Console → Your App → Login with Amazon → Web Settings →
					Allowed Return URLs
				</p>
			</div>
		</div>

		<div class="card">
			<div class="card-header">
				<h2>Step 3: Initiate OAuth Flow</h2>
				<p class="card-description">
					Click the button below to start the OAuth authorization process:
				</p>
			</div>
			<div class="card-content">
				<button class="oauth-button" on:click={initiateOAuth} disabled={loading}>
					{loading ? 'Generating Authorization URL...' : 'Start OAuth Flow'}
				</button>

				{#if authData && authData.authUrl}
					<div class="oauth-result">
						<div class="alert success">
							<div>
								<p><strong>Authorization URL generated successfully!</strong></p>
								<p>A new tab should have opened with the Amazon authorization page.</p>
								<p>If it didn't open automatically, click the link below:</p>
							</div>
						</div>

						<div class="url-section">
							<p class="url-label">Authorization URL:</p>
							<a href={authData.authUrl} target="_blank" rel="noopener noreferrer" class="url-link">
								{authData.authUrl}
							</a>
						</div>

						<div class="instructions-section">
							<p class="instructions-label">Instructions:</p>
							<ol class="instructions-list">
								{#each authData.instructions as instruction}
									<li>{instruction}</li>
								{/each}
							</ol>
						</div>
					</div>
				{/if}

				{#if authData && authData.code}
					<div class="alert success oauth-complete">
						<div>
							<p><strong>OAuth flow completed successfully!</strong></p>
							<p>Check your server console for the refresh token.</p>
							<p>Copy the refresh token and add it to your .env file as AMAZON_REFRESH_TOKEN</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="card">
			<div class="card-header">
				<h2>Step 4: Next Steps</h2>
				<p class="card-description">After completing the OAuth flow:</p>
			</div>
			<div class="card-content">
				<div class="checklist">
					<div class="checklist-item">
						<span class="badge number">1</span>
						<span>Copy the refresh token from your server console</span>
					</div>
					<div class="checklist-item">
						<span class="badge number">2</span>
						<span>Add it to your .env file as AMAZON_REFRESH_TOKEN</span>
					</div>
					<div class="checklist-item">
						<span class="badge number">3</span>
						<span>Add your AWS credentials to complete the setup</span>
					</div>
					<div class="checklist-item">
						<span class="badge number">4</span>
						<span>Test the integration with Amazon SP-API</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		min-height: 100vh;
		padding: 2rem 1rem;
		background-color: #f8fafc;
	}

	.content {
		max-width: 64rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.header {
		text-align: center;
		margin-bottom: 1rem;
	}

	.header h1 {
		font-size: 2rem;
		font-weight: bold;
		color: #1e293b;
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		color: #64748b;
		margin: 0;
	}

	.card {
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		border: 1px solid #e2e8f0;
	}

	.card-header {
		padding: 1.5rem 1.5rem 0.5rem 1.5rem;
	}

	.card-header h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1e293b;
		margin: 0 0 0.5rem 0;
	}

	.card-description {
		color: #64748b;
		margin: 0;
	}

	.card-content {
		padding: 0.5rem 1.5rem 1.5rem 1.5rem;
	}

	.alert {
		padding: 1rem;
		border-radius: 0.375rem;
		margin-bottom: 1rem;
	}

	.alert.error {
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
	}

	.alert.success {
		background-color: #f0f9ff;
		border: 1px solid #bae6fd;
		color: #0c4a6e;
	}

	.checklist {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.checklist-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		background-color: #f1f5f9;
		color: #475569;
		border: 1px solid #e2e8f0;
		border-radius: 0.25rem;
	}

	.badge.number {
		background-color: #dbeafe;
		color: #1e40af;
		border-color: #bfdbfe;
	}

	.code-block {
		background-color: #f8fafc;
		padding: 1rem;
		border-radius: 0.375rem;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		border: 1px solid #e2e8f0;
		word-break: break-all;
	}

	.help-text {
		color: #64748b;
		font-size: 0.875rem;
		margin-top: 0.5rem;
		margin-bottom: 0;
	}

	.oauth-button {
		width: 100%;
		padding: 0.75rem 1rem;
		background-color: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.oauth-button:hover:not(:disabled) {
		background-color: #2563eb;
	}

	.oauth-button:disabled {
		background-color: #94a3b8;
		cursor: not-allowed;
	}

	.oauth-result {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.oauth-complete {
		margin-top: 1rem;
	}

	.url-section {
		background-color: #f8fafc;
		padding: 1rem;
		border-radius: 0.375rem;
		border: 1px solid #e2e8f0;
	}

	.url-label {
		font-size: 0.875rem;
		font-weight: 500;
		margin: 0 0 0.5rem 0;
	}

	.url-link {
		color: #2563eb;
		text-decoration: none;
		font-size: 0.875rem;
		word-break: break-all;
	}

	.url-link:hover {
		text-decoration: underline;
	}

	.instructions-section {
		background-color: #eff6ff;
		padding: 1rem;
		border-radius: 0.375rem;
		border: 1px solid #bfdbfe;
	}

	.instructions-label {
		font-size: 0.875rem;
		font-weight: 500;
		margin: 0 0 0.5rem 0;
	}

	.instructions-list {
		font-size: 0.875rem;
		margin: 0;
		padding-left: 1.25rem;
	}

	.instructions-list li {
		margin-bottom: 0.25rem;
	}
</style>
