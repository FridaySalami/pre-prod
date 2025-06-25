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
	import * as Sidebar from '$lib/shadcn/ui/sidebar/index.js';
	import AppSidebar from '$lib/AppSidebar.svelte';
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
		console.log('🟢 Layout session subscription triggered with:', s);

		// Update the session state
		session = s;
		console.log(
			'🟢 Layout session updated:',
			session ? 'session exists' : session === null ? 'no session' : 'undefined'
		);

		// Only redirect to login if we have a definitive null session (logged out)
		// and we're not in the process of logging out and not already on login page
		if (
			browser &&
			session === null &&
			!loggingOut &&
			!window.location.pathname.includes('/login')
		) {
			console.log('🟢 Session is null, redirecting to login page');
			window.location.href = '/login';
		}
	});

	onDestroy(() => {
		unsubscribe();
	});

	async function handleLogout(event: MouseEvent) {
		console.log('🟢 Layout logout function triggered');
		if (event && event.preventDefault) {
			event.preventDefault();
		}

		loggingOut = true;
		console.log('🟢 loggingOut state set to true');

		try {
			// Clear localStorage items related to Supabase first
			console.log('🟢 Clearing localStorage items...');
			if (browser) {
				Object.keys(localStorage).forEach((key) => {
					if (key.includes('supabase') || key.includes('sb-')) {
						console.log(`🟢 Removing localStorage item: ${key}`);
						localStorage.removeItem(key);
					}
				});
			}

			// Sign out from Supabase - this should automatically update the session store
			console.log('🟢 Calling Supabase signOut...');
			await supabase.auth.signOut();
			console.log('🟢 Supabase signOut completed');

			// Navigate to login page
			console.log('🟢 Redirecting to login...');
			window.location.href = '/login';
		} catch (err) {
			console.error('🟢 Unexpected error during logout:', err);
			// Ensure we always redirect even if there's an error
			loggingOut = false;
			window.location.href = '/login';
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

		// Add custom logout event listener
		const handleCustomLogout = (event: Event) => {
			const customEvent = event as CustomEvent;
			handleLogout(customEvent.detail);
		};
		document.addEventListener('app-logout', handleCustomLogout);

		// Return cleanup function directly
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleGlobalKeydown);
			document.removeEventListener('app-logout', handleCustomLogout);
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
	<script
		defer
		src="https://cloud.umami.is/script.js"
		data-website-id="22acb77e-4bb1-47a2-8305-7952ac07e62e"
	></script>
</svelte:head>

<div class="app-container" class:has-banner={showPasswordBanner}>
	<Sidebar.Provider class="" style="">
		<AppSidebar />
		<main class="sidebar-main">
			<header class="site-header">
				<div class="header-left">
					<Sidebar.Trigger class="" onclick={() => {}} />
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

			<div class="main-content">
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
			</div>

			<footer class="site-footer">
				<p>
					Created by Jack Weston | <a href="/release-notes" class="footer-link">Release notes</a>
				</p>
			</footer>
		</main>
	</Sidebar.Provider>

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

	.app-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.sidebar-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
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
		gap: 16px;
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

	/* Main Content */
	.main-content {
		flex: 1;
		padding: 20px;
		padding-top: 10px;
		background-color: #f9fafb;
		width: 100%;
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
		z-index: 999;
		width: 100%;
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
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(4px);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		z-index: 2000;
	}

	.logout-spinner {
		border: 4px solid rgba(0, 66, 37, 0.1);
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
		font-size: 1rem;
		font-weight: 500;
		color: #004225;
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
		border-left: 4px solid #3b82f6;
	}

	.toast.success {
		border-left-color: #10b981;
	}

	.toast.warning {
		border-left-color: #f59e0b;
	}

	.toast.error {
		border-left-color: #ef4444;
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

	/* Adjust for banner */
	.app-container.has-banner {
		padding-top: 33px;
	}
</style>
