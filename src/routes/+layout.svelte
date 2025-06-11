<script lang="ts">
	import '../global.css';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/sessionStore';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabaseClient';
	import type { Session } from '@supabase/supabase-js';
	import { toastStore } from '$lib/toastStore';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import CommandMenu from '$lib/CommandMenu.svelte';
	let currentPath = '';

	// Subscribe to the page store to get the current path
	page.subscribe((value) => {
		currentPath = value.url.pathname;
	});

	// Initialize session as undefined
	let session: any = undefined;
	let loggingOut = false;
	let commandMenuOpen = false;

	// Toast notification system
	let toastVisible = false;
	let toastMessage = '';
	let toastType = 'info'; // Can be: info, success, warning, error
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	// Function to show toast
	function showToast(message: string, type: string = 'info', duration: number = 5000) {
		// Clear any existing timeout
		if (toastTimeout) clearTimeout(toastTimeout);

		// Set toast properties
		toastMessage = message;
		toastType = type;
		toastVisible = true;

		// Auto-hide after duration
		toastTimeout = setTimeout(() => {
			toastVisible = false;
		}, duration);
	}

	// Subscribe to the toast store
	toastStore.subscribe((toast) => {
		toastVisible = toast.show;
		toastMessage = toast.message;
		toastType = toast.type;
	});

	const unsubscribe = userSession.subscribe((s) => {
		console.log('Session subscription triggered with:', s);

		// If we're in the process of logging out, always treat the session as null
		if (loggingOut) {
			session = null;
			console.log('In logout process, treating session as null');
		} else {
			session = s;
			console.log(
				'Layout session updated:',
				session ? 'session exists' : 'no session or undefined'
			);
		}

		// Redirect to login if session is null and we're not already logging out
		if (
			browser &&
			session === null &&
			!loggingOut &&
			!window.location.pathname.includes('/login')
		) {
			console.log('Session is null, redirecting to login page');
			window.location.replace('/login'); // Use replace to prevent history issues
		}
	});

	onDestroy(() => {
		unsubscribe();
	});

	async function handleLogout(event: MouseEvent) {
		console.log('Logout function triggered');
		if (event && event.preventDefault) {
			event.preventDefault();
		}

		loggingOut = true;
		console.log('loggingOut state set to true');

		try {
			// Create a flag to check if any auth operations succeeded
			let authCleared = false;

			// 1. Try the Supabase signOut method first
			console.log('Attempting to sign out with Supabase...');
			try {
				const { error } = await supabase.auth.signOut({
					scope: 'global' // This will invalidate all sessions for this user
				});

				if (!error) {
					console.log('Successfully signed out from Supabase');
					authCleared = true;
				} else {
					console.log('Error during Supabase signout:', error);
				}
			} catch (err) {
				console.log('Exception during Supabase signout:', err);
			}

			// 2. Clear all localStorage items related to Supabase
			console.log('Clearing localStorage items...');
			for (const key in localStorage) {
				if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
					if (key.includes('supabase') || key.includes('sb-')) {
						console.log(`Removing localStorage item: ${key}`);
						localStorage.removeItem(key);
						authCleared = true;
					}
				}
			}

			// 3. Clear all cookies
			console.log('Clearing cookies...');
			document.cookie.split(';').forEach(function (c) {
				document.cookie = c
					.replace(/^ +/, '')
					.replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
			});

			// 4. Explicitly set the session store to null
			userSession.set(null);
			console.log('userSession store set to null');

			// 5. Try to refresh the Supabase client to clear its internal state
			try {
				// @ts-ignore - Using internal API to refresh client state
				if (supabase.auth.refreshSession) {
					await supabase.auth.refreshSession();
					console.log('Refreshed Supabase session');
				}
			} catch (err) {
				console.log('Error refreshing session, continuing:', err);
			}

			// 6. Force a full page reload with a brief delay to allow for async operations to complete
			console.log('Setting timeout for reload...');
			setTimeout(() => {
				// Use window.location.replace instead of href to prevent caching issues
				console.log('Performing full page reload...');

				// Force browser to not use cache
				window.location.replace('/login?t=' + new Date().getTime());
			}, 1000);
		} catch (err) {
			console.error('Unexpected error during logout:', err);
			loggingOut = false;
		}
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (commandMenuOpen) {
			const commandContainer = document.querySelector('.command-menu-container');
			const commandDropdown = document.querySelector('.command-dropdown');
			if (
				commandContainer &&
				commandDropdown &&
				!commandContainer.contains(event.target as Node) &&
				!commandDropdown.contains(event.target as Node)
			) {
				commandMenuOpen = false;
			}
		}
	}

	// Global keyboard shortcut handler
	function handleGlobalKeydown(event: KeyboardEvent) {
		// Cmd+K or Ctrl+K to toggle command menu
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			commandMenuOpen = !commandMenuOpen;
		}
	}

	let showPasswordBanner: boolean = false;

	// Create a separate async function for checking password status
	async function checkUserPasswordStatus() {
		try {
			if (!session || !session.user) {
				// No active session, don't show banner
				showPasswordBanner = false;
				return;
			}

			// Check authentication method from session metadata
			const authProvider = session.user.app_metadata?.provider;

			// If we don't have a provider or it's not "email" with password, show banner
			// This will catch magic link logins, SSO, and OAuth
			showPasswordBanner = !authProvider || authProvider !== 'email';

			// If we have local storage flag that password was set, don't show banner
			if (browser && localStorage.getItem('password_set') === 'true') {
				showPasswordBanner = false;
			}

			console.log('Auth provider check:', {
				provider: authProvider,
				showBanner: showPasswordBanner
			});
		} catch (err) {
			console.error('Error checking user auth status:', err);
			showPasswordBanner = false;
		}

		// Update body padding based on banner status
		if (browser) {
			if (showPasswordBanner) {
				document.body.style.paddingTop = '33px';
			} else {
				document.body.style.paddingTop = '0';
			}
		}
	}

	// Modified onMount function to avoid Promise<function> return
	onMount(() => {
		// Call the async function without awaiting it here
		checkUserPasswordStatus();

		// Add event listeners synchronously
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleGlobalKeydown);

		// Return cleanup function directly
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleGlobalKeydown);
		};
	});

	// Function to dismiss the banner
	function dismissPasswordBanner(): void {
		showPasswordBanner = false;
	}

	// Make sure this reactive statement is typed properly
	$: if (browser) {
		if (showPasswordBanner === true) {
			document.body.style.paddingTop = '33px';
		} else {
			document.body.style.paddingTop = '0';
		}
	}
</script>

<svelte:head>
	<link href="https://fonts.googleapis.com/css2?family=Material+Icons+Outlined" rel="stylesheet" />
</svelte:head>

<div class="app-container" class:has-banner={showPasswordBanner}>
	<aside class="sidebar">
		<div class="sidebar-logo">
			<span class="app-icon">P</span>
		</div>
		<nav>
			<ul>
				<!-- Home/Landing Link -->
				<li>
					<a href="/landing" class:active={currentPath === '/landing'}>
						<i class="material-icons-outlined menu-icon">home</i>
						<span class="label">Home</span>
					</a>
				</li>

				<!-- Dashboard Link -->
				<li>
					<a href="/dashboard" class:active={currentPath === '/dashboard'}>
						<i class="material-icons-outlined menu-icon">dashboard</i>
						<span class="label">Dashboard</span>
					</a>
				</li>

				<!-- Analytics Link -->
				<li>
					<a href="/analytics" class:active={currentPath === '/analytics'}>
						<i class="material-icons-outlined menu-icon">analytics</i>
						<span class="label">Analytics</span>
					</a>
				</li>

				<!-- Monthly Analytics Link -->
				<li>
					<a
						href="/analytics/monthly"
						class:active={currentPath && currentPath.includes('/analytics/monthly')}
					>
						<i class="material-icons-outlined menu-icon">trending_up</i>
						<span class="label">Monthly Analytics</span>
					</a>
				</li>

				<!-- Kaizen Projects Link -->
				<li>
					<a
						href="/kaizen-projects"
						class:active={currentPath && currentPath.includes('/kaizen-projects')}
					>
						<i class="material-icons-outlined menu-icon">assignment</i>
						<span class="label">Kaizen Projects</span>
					</a>
				</li>

				<!-- Process Map Link -->
				<li>
					<a href="/process-map" class:active={currentPath && currentPath.includes('/process-map')}>
						<i class="material-icons-outlined menu-icon">account_tree</i>
						<span class="label">Process Map</span>
					</a>
				</li>

				<!-- Schedules Link -->
				<li>
					<a href="/schedules" class:active={currentPath && currentPath.includes('/schedules')}>
						<i class="material-icons-outlined menu-icon">calendar_today</i>
						<span class="label">Schedules</span>
					</a>
				</li>

				<!-- Any other navigation items -->
			</ul>
		</nav>
	</aside>

	<div class="content-wrapper">
		<header class="site-header">
			<div class="header-left">
				<h1>Parkers Foodservice</h1>
				<div class="header-divider"></div>
				<span class="header-subtitle">Operations Dashboard</span>
			</div>
			<div class="header-right">
				<!-- Command Menu Button Container -->
				<div class="command-menu-container">
					<button
						class="command-menu-button"
						onclick={() => (commandMenuOpen = !commandMenuOpen)}
						title="Search (⌘K)"
					>
						<i class="material-icons-outlined">search</i>
						<span class="command-menu-text">Search</span>
						<span class="shortcut-hint">⌘K</span>
					</button>
				</div>
			</div>
		</header>

		<!-- Add below header -->
		<main class="site-main">
			{#if showPasswordBanner}
				<div class="password-setup-banner" transition:fade={{ duration: 300 }}>
					<p>
						<i class="material-icons-outlined banner-icon">info</i>
						Complete your account setup by setting a password
					</p>
					<div class="banner-actions">
						<a href="/set-password" class="banner-button">Complete Setup</a>
						<button class="banner-dismiss" onclick={dismissPasswordBanner}>
							<i class="material-icons-outlined">close</i>
						</button>
					</div>
				</div>
			{/if}
			<slot />
		</main>

		<footer class="site-footer">
			<p>Created by Jack Weston | <a href="/release-notes" class="footer-link">Release notes</a></p>
		</footer>
	</div>

	<!-- Add Toast Container Here -->
	<div id="toast-container" class:visible={toastVisible}>
		<div class="toast {toastType}">
			<span>{toastMessage}</span>
			<button onclick={() => (toastVisible = false)}>
				<i class="material-icons-outlined">close</i>
			</button>
		</div>
	</div>
</div>

<!-- Command Menu Component -->
<CommandMenu bind:open={commandMenuOpen} on:close={() => (commandMenuOpen = false)} />

{#if loggingOut}
	<div class="logout-overlay">
		<div class="logout-spinner"></div>
		<p>Logging out...</p>
	</div>
{/if}

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		font-family:
			'SF Pro Display',
			'Roboto',
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		background-color: #f9fafb;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	/* Header with gradient background */
	.site-header {
		background-color: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
		padding: 0 24px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #e5e7eb;
		height: 64px;
		color: #1f2937;
		position: sticky;
		top: 0;
		z-index: 999;
		width: 100%;
	}

	.header-left {
		display: flex;
		align-items: center;
	}

	.header-left h1 {
		margin: 0;
		font-size: 1.25em;
		font-weight: 600;
		color: #004225;
		letter-spacing: -0.01em;
	}

	.header-divider {
		height: 24px;
		width: 1px;
		background-color: #e5e7eb;
		margin: 0 16px;
	}

	.header-subtitle {
		color: #6b7280;
		font-size: 1.1em;
		font-weight: 400;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.command-menu-container {
		position: relative;
	}

	.command-menu-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		background-color: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 8px 16px;
		color: #6b7280;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.875rem;
		transition: all 0.2s ease;
		outline: none;
		width: 280px; /* Fixed width to match dropdown */
		min-width: 280px;
	}

	.command-menu-button:hover {
		background-color: #f3f4f6;
		border-color: #d1d5db;
		color: #374151;
	}

	.command-menu-button:focus {
		border-color: #004225;
		box-shadow: 0 0 0 3px rgba(0, 66, 37, 0.1);
	}

	.command-menu-button i {
		font-size: 18px;
		flex-shrink: 0;
	}

	.command-menu-text {
		flex: 1;
		text-align: left;
		margin-left: 8px;
	}

	.shortcut-hint {
		background-color: #e5e7eb;
		color: #6b7280;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		border: 1px solid #d1d5db;
	}

	/* Collapsible Sidebar */
	.sidebar {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		width: 64px;
		background-color: #fff;
		border-right: 1px solid #e5e7eb;
		/* Remove overflow: hidden; which is causing issues */
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Apple-like easing */
		z-index: 1000;
		display: flex;
		flex-direction: column;
	}

	.sidebar:hover {
		width: 220px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* Add subtle shadow when expanded */
	}

	.sidebar-logo {
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid #f3f4f6;
	}

	.app-icon {
		width: 32px;
		height: 32px;
		background-color: #004225; /* Flat color instead of gradient */
		color: white;
		border-radius: 10px; /* Slightly more rounded */
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600; /* Slightly bolder */
		font-size: 18px;
		letter-spacing: 0.02em; /* Subtle letter spacing */
		box-shadow: 0 2px 4px rgba(0, 66, 37, 0.2); /* Subtle shadow */
	}

	.sidebar nav {
		flex: 1;
		/* Change from overflow-y: auto to overflow: hidden when collapsed */
		overflow: hidden;
	}

	.sidebar:hover nav {
		overflow-y: auto; /* Show scrollbar only when needed and hovered */
	}

	.sidebar nav ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.sidebar nav ul li {
		border-bottom: 1px solid #f3f4f6; /* Lighter border */
	}

	.sidebar nav ul li a {
		display: flex;
		align-items: center;
		padding: 12px 16px; /* Increased padding */
		color: #1f2937; /* Darker text */
		text-decoration: none;
		font-weight: 500;
		transition: all 0.2s ease;
		border-left: 3px solid transparent; /* For selected state indicator */
	}

	.sidebar nav ul li a:hover {
		background-color: rgba(53, 176, 123, 0.1); /* More subtle hover color */
	}

	.menu-icon {
		font-size: 22px; /* Slightly smaller */
		margin-right: 12px;
		color: #6b7280; /* Lighter gray for inactive */
		flex-shrink: 0;
	}

	.label {
		opacity: 0;
		transition: opacity 0.2s ease;
		white-space: nowrap;
		font-size: 0.9em;
	}

	.sidebar:hover .label {
		opacity: 1;
	}

	.sidebar-logout {
		border-top: 1px solid #e5e7eb;
		padding: 12px 8px; /* Reduced horizontal padding from 16px to 8px */
		margin-top: 16px;
		margin-bottom: 20px;
		width: 100%;
		overflow: hidden; /* Prevent content from overflowing */
	}

	.logout-button {
		display: flex;
		align-items: center;
		width: calc(100% - 2px); /* Account for border */
		padding: 10px 8px; /* Reduced horizontal padding from 12px to 8px */
		color: #1f2937;
		background: transparent;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		font-weight: 500;
		font-size: 0.9em;
		transition: all 0.2s ease;
		cursor: pointer;
		overflow: hidden; /* Prevent content from overflowing */
	}

	.logout-button:hover {
		background-color: rgba(239, 68, 68, 0.1); /* Subtle red for logout */
		border-color: rgba(239, 68, 68, 0.2);
		color: rgb(185, 28, 28);
	}

	/* Main Content */
	.site-main {
		flex: 1;
		padding: 20px;
		padding-top: 10px; /* Reduced top padding */
		background-color: #f9fafb;
		width: 100%; /* Takes full width of content-wrapper */
		margin-left: 0; /* Remove this as it's redundant with content-wrapper margin */
	}

	/* Footer */
	.site-footer {
		background-color: #fff;
		border-top: 1px solid #e5e7eb;
		color: #6b7280;
		font-size: 0.8em;
		padding: 8px 24px;
		height: 36px;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		z-index: 999; /* Ensure it stays above content but below modals */
		width: 100%; /* Make sure it extends full width */
		position: sticky;
		bottom: 0;
	}

	.site-footer p {
		margin: 0;
	}

	.footer-link {
		color: #004225;
		text-decoration: none;
		font-weight: 500;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.footer-link:hover {
		background-color: rgba(53, 176, 123, 0.1);
		text-decoration: none;
	}

	/* Logout overlay styles */
	.logout-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.9); /* More opaque */
		backdrop-filter: blur(4px); /* Apple-like blur effect */
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		z-index: 2000;
	}

	.logout-spinner {
		border: 4px solid rgba(0, 66, 37, 0.1); /* Thinner, more subtle spinner */
		border-top: 4px solid #004225;
		border-radius: 50%;
		width: 40px;
		height: 40px;
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

	.logout-overlay p {
		margin-top: 1rem;
		font-size: 1rem; /* Slightly smaller */
		font-weight: 500; /* Medium weight */
		color: #004225;
	}

	.app-container {
		display: flex;
		min-height: 100vh;
	}

	.content-wrapper {
		flex: 1;
		margin-left: 64px; /* Match sidebar width */
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		width: calc(100% - 64px); /* Ensure it takes up the remaining width */
	}

	/* Add these style tweaks to hide scrollbar when not needed */
	.sidebar nav::-webkit-scrollbar {
		width: 4px;
	}

	.sidebar nav::-webkit-scrollbar-track {
		background: transparent;
	}

	.sidebar nav::-webkit-scrollbar-thumb {
		background-color: rgba(107, 114, 128, 0.3);
		border-radius: 4px;
	}

	/* Only show scrollbar on hover */
	.sidebar:not(:hover) nav::-webkit-scrollbar {
		display: none;
	}

	/* Toast notification system */
	#toast-container {
		position: fixed;
		bottom: 50px;
		right: 20px;
		z-index: 1500;
		max-width: 400px;
		min-width: 300px;
		opacity: 0;
		transform: translateY(20px);
		transition: all 0.3s ease;
		pointer-events: none;
	}

	#toast-container.visible {
		opacity: 1;
		transform: translateY(0);
		pointer-events: all;
	}

	.toast {
		background-color: white;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		padding: 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.9em;
		border-left: 4px solid #3b82f6; /* Default blue for info */
	}

	.toast.success {
		border-left-color: #10b981; /* Green for success */
	}

	.toast.warning {
		border-left-color: #f59e0b; /* Yellow for warning */
	}

	.toast.error {
		border-left-color: #ef4444; /* Red for error */
	}

	.toast button {
		background: transparent;
		border: none;
		color: #6b7280;
		cursor: pointer;
		padding: 4px;
		margin-left: 16px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.toast button:hover {
		background-color: #f3f4f6;
	}

	.password-setup-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background-color: #004225;
		color: white;
		z-index: 1001;
		padding: 6px 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.85rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.password-setup-banner p {
		margin: 0;
		display: flex;
		align-items: center;
	}

	.banner-icon {
		font-size: 18px;
		margin-right: 8px;
	}

	.banner-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.banner-button {
		background-color: rgba(255, 255, 255, 0.2);
		color: white;
		text-decoration: none;
		padding: 4px 12px;
		border-radius: 16px;
		font-size: 0.8rem;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.banner-button:hover {
		background-color: rgba(255, 255, 255, 0.3);
	}

	.banner-dismiss {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
	}

	.banner-dismiss:hover {
		background-color: rgba(255, 255, 255, 0.1);
		color: white;
	}

	/* Adjust content-wrapper to account for banner */
	.app-container.has-banner .sidebar {
		top: 33px; /* Height of banner */
	}

	.app-container.has-banner .content-wrapper {
		margin-top: 33px; /* Height of banner */
	}
</style>
