<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';
	import { userSession } from '$lib/sessionStore';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let email = '';
	let password = '';
	let errorMessage = '';
	let loading = false;
	let redirectTo = '';

	onMount(() => {
		// Check if user is already authenticated
		if (browser) {
			const currentSession = $userSession;
			if (currentSession) {
				console.log('🔐 User already authenticated, redirecting...');
				goto('/dashboard');
				return;
			}
		}

		// Check for previous login errors
		if (browser) {
			const lastResult = localStorage.getItem('login-result');
			if (lastResult) {
				try {
					const result = JSON.parse(lastResult);
					if (!result.success && result.error) {
						errorMessage = `Login failed: ${result.error}`;
						console.log('🔐 Previous login error:', result);
					}
					// Clear the stored result
					localStorage.removeItem('login-result');
				} catch (e) {
					console.error('Error parsing stored login result:', e);
				}
			}
		}

		// Get redirect URL from query params
		redirectTo = $page.url.searchParams.get('redirectTo') || '/dashboard';

		// Check for any messages in query params
		const message = $page.url.searchParams.get('message');
		if (message) {
			switch (message) {
				case 'logged-out':
					// Don't show error for successful logout
					break;
				case 'logout-error':
					errorMessage = 'There was an issue during logout, but you have been signed out.';
					break;
				case 'session-expired':
					errorMessage = 'Your session has expired. Please log in again.';
					break;
				case 'insufficient-permissions':
					errorMessage = 'You do not have permission to access that page.';
					break;
				default:
					errorMessage = message;
			}
		}
	});

	async function handleLogin() {
		errorMessage = '';
		loading = true;

		try {
			console.log('🔐 Starting server-side login process...');
			console.log('🔐 Email:', email);
			console.log('🔐 Password length:', password.length);

			// Store in localStorage to persist through redirects
			localStorage.setItem(
				'login-attempt',
				JSON.stringify({
					email: email,
					timestamp: Date.now(),
					status: 'attempting'
				})
			);

			// Use server-side authentication endpoint
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include', // Important for cookies
				body: JSON.stringify({
					email: email.trim(),
					password
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Login failed');
			}

			const data = await response.json();
			console.log('🔐 Server login response:', data);

			// Store result in localStorage
			localStorage.setItem(
				'login-result',
				JSON.stringify({
					success: data.success,
					error: null,
					hasSession: !!data.session,
					hasUser: !!data.user,
					timestamp: Date.now()
				})
			);

			if (!data.success || !data.session || !data.user) {
				console.error('🔐 No session or user returned from server login');
				throw new Error('Login failed - no session created');
			}

			console.log('🔐 Server login successful, session created:', {
				userId: data.user.id,
				email: data.user.email
			});

			// Update session store to sync client state
			userSession.set(data.session);

			// Store success for debugging
			localStorage.setItem(
				'login-success',
				JSON.stringify({
					success: true,
					userId: data.user.id,
					email: data.user.email,
					timestamp: Date.now()
				})
			);

			// Wait a moment for session to propagate, then use SvelteKit navigation
			console.log('🔐 Login successful, redirecting to:', redirectTo);
			setTimeout(() => {
				goto(redirectTo);
			}, 100);
		} catch (err: any) {
			console.error('🔐 Login error:', err);
			loading = false;

			// Handle specific error types
			if (err.message?.includes('Invalid login credentials')) {
				errorMessage = 'Invalid email or password. Please check your credentials and try again.';
			} else if (err.message?.includes('Email not confirmed')) {
				errorMessage = 'Please check your email and click the confirmation link before logging in.';
			} else if (err.message?.includes('Too many requests')) {
				errorMessage = 'Too many login attempts. Please wait a moment before trying again.';
			} else if (err.message?.includes('network')) {
				errorMessage = 'Network error. Please check your connection and try again.';
			} else {
				errorMessage = err.message || 'An unexpected error occurred. Please try again.';
			}
		}
	}

	// Clear error when user starts typing
	function clearError() {
		if (errorMessage) {
			errorMessage = '';
		}
	}

	// Handle Enter key press
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !loading) {
			event.preventDefault();
			handleLogin();
		}
	}
</script>

{#if loading}
	<div class="spinner-container">
		<div class="spinner"></div>
		<p class="loading-text">Signing you in...</p>
	</div>
{:else}
	<div class="login-container">
		<h1>Sign In</h1>

		{#if errorMessage}
			<div class="error" role="alert">
				<span class="error-icon">⚠️</span>
				<span>{errorMessage}</span>
			</div>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleLogin();
			}}
		>
			<div class="form-group">
				<label for="email">Email Address</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					oninput={() => {
						errorMessage = '';
					}}
					onkeydown={handleKeydown}
					placeholder="Enter your email"
					required
					autocomplete="email"
					disabled={loading}
				/>
			</div>

			<div class="form-group">
				<label for="password">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					oninput={() => {
						errorMessage = '';
					}}
					onkeydown={handleKeydown}
					placeholder="Enter your password"
					required
					autocomplete="current-password"
					disabled={loading}
				/>
			</div>

			<button type="submit" disabled={loading}>
				{#if loading}
					<span class="button-spinner"></span>
					Signing In...
				{:else}
					Sign In
				{/if}
			</button>
		</form>

		<div class="form-footer">
			<p class="help-text">Need help? Contact your system administrator.</p>
		</div>
	</div>
{/if}

<style>
	.login-container {
		max-width: 420px;
		margin: 4rem auto;
		padding: 2rem;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		background: #fff;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.1),
			0 4px 20px rgba(0, 0, 0, 0.08);
		font-family: 'Roboto', sans-serif;
	}

	h1 {
		color: #1f2937;
		font-size: 1.75rem;
		font-weight: 600;
		margin: 0 0 2rem 0;
		text-align: center;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
		color: #374151;
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 1rem;
		transition: all 0.2s ease;
		background: #fff;
	}

	input:focus {
		outline: none;
		border-color: #004225;
		box-shadow: 0 0 0 3px rgba(0, 66, 37, 0.1);
	}

	input:disabled {
		background: #f9fafb;
		cursor: not-allowed;
	}

	input::placeholder {
		color: #9ca3af;
	}

	button {
		width: 100%;
		background-color: #004225;
		color: #fff;
		border: none;
		padding: 0.875rem 1rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 600;
		margin-top: 0.5rem;
		transition: all 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	button:hover:not(:disabled) {
		background: #006339;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.error {
		color: #dc2626;
		background-color: #fef2f2;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
		border-left: 4px solid #dc2626;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.error-icon {
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.form-footer {
		margin-top: 1.5rem;
		text-align: center;
	}

	.help-text {
		color: #6b7280;
		font-size: 0.85rem;
		margin: 0;
	}

	.loading-text {
		color: #374151;
		font-size: 1.1rem;
		margin: 0;
	}

	.spinner-container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 300px;
		gap: 1rem;
	}

	.spinner {
		border: 4px solid rgba(0, 66, 37, 0.1);
		border-top: 4px solid #004225;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
	}

	.button-spinner {
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid #fff;
		border-radius: 50%;
		width: 16px;
		height: 16px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.login-container {
			margin: 2rem 1rem;
			padding: 1.5rem;
		}
	}
</style>
