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
	import { checkRouteAccess } from '$lib/routeGuard';
	import type { Snippet } from 'svelte';
	import { syncStore } from '$lib/stores/syncStore';

	interface Props {
		children: Snippet;
		data: any; // Server-side data from +layout.server.ts
	}

	// Get props for Svelte 5 layout including server data
	let { children, data }: Props = $props();

	let currentPath = '';

	// Use server-side session data as the source of truth
	let session = $state<Session | null>(data?.session || null);
	let user = $state(data?.user || null);

	// Subscribe to the page store to get the current path
	let unsubscribePage = page.subscribe((value) => {
		currentPath = value.url.pathname;

		// Check route access on client-side navigation
		if (browser) {
			checkRouteAccess(currentPath, user);
		}
	});

	// Cleanup subscription on destroy
	onDestroy(() => {
		if (unsubscribePage) {
			unsubscribePage();
		}
		if (unsubscribeToast) {
			unsubscribeToast();
		}
	});

	let loggingOut = $state(false);
	let commandMenuOpen = $state(false);

	// Reactive logging that properly tracks state changes (only log when values actually change)
	let previousSessionId = $state<string | null>(null);
	let previousUserId = $state<string | null>(null);

	$effect(() => {
		// Use IDs for comparison instead of object references to avoid proxy equality issues
		const currentSessionId = session?.user?.id || null;
		const currentUserId = user?.id || null;

		// Only log if session or user actually changed
		if (currentSessionId !== previousSessionId || currentUserId !== previousUserId) {
			console.log('🔐 Layout state changed:', {
				hasSession: !!session,
				hasUser: !!user,
				userRole: user?.profile?.role
			});
			previousSessionId = currentSessionId;
			previousUserId = currentUserId;
		}
	});

	// Toast notification system
	let toastVisible = $state(false);
	let toastMessage = $state('');
	let toastType = $state('info'); // Can be: info, success, warning, error
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
	let unsubscribeToast = toastStore.subscribe((toast) => {
		toastVisible = toast.show;
		toastMessage = toast.message;
		toastType = toast.type;
	});

	// Update session and user when server data changes (page navigation)
	// Use props to track data changes instead of reactive effect
	$effect(() => {
		// Only update if the data actually changed - use deep comparison for objects
		const newSession = data?.session || null;
		const newUser = data?.user || null;

		// Compare using serialization to avoid proxy equality issues
		const sessionChanged = JSON.stringify(newSession) !== JSON.stringify(session);
		const userChanged = JSON.stringify(newUser) !== JSON.stringify(user);

		if (sessionChanged || userChanged) {
			session = newSession;
			user = newUser;

			console.log('🔐 Layout data updated from server:', {
				hasSession: !!session,
				hasUser: !!user,
				userRole: user?.profile?.role,
				currentPath
			});

			// Only sync session store if we have server session data
			// Don't override existing client session with null from server
			if (session) {
				userSession.set(session);
			} else if (data?.session === null) {
				// Only set to null if server explicitly says no session
				userSession.set(null);
			}
			// If data.session is undefined, don't modify the store
		}
	});

	async function handleLogout(event: MouseEvent) {
		console.log('🟢 Layout logout function triggered');
		if (event && event.preventDefault) {
			event.preventDefault();
		}

		loggingOut = true;
		console.log('🟢 loggingOut state set to true');

		try {
			// First, call the server-side logout endpoint for proper session cleanup
			console.log('🟢 Calling server-side logout endpoint');
			const response = await fetch('/api/auth/logout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				console.log('🟢 Server-side logout successful');
			} else {
				console.warn('🟢 Server-side logout returned non-OK status:', response.status);
			}

			// Clear localStorage items related to Supabase
			console.log('🟢 Clearing localStorage items...');
			if (browser) {
				Object.keys(localStorage).forEach((key) => {
					if (key.includes('supabase') || key.includes('sb-')) {
						console.log(`🟢 Removing localStorage item: ${key}`);
						localStorage.removeItem(key);
					}
				});
			}

			// Clear client-side state immediately
			session = null;
			user = null;
			userSession.set(null);

			// Clear client-side Supabase session as backup
			console.log('🟢 Calling client-side Supabase signOut...');
			await supabase.auth.signOut();
			console.log('🟢 Client-side Supabase signOut completed');

			// Force a hard navigation to ensure server-side session is completely cleared
			console.log('🟢 Forcing page reload and redirect to login...');
			window.location.href = '/login?message=logged-out';
		} catch (err) {
			console.error('🟢 Error during logout process:', err);

			// Fallback: Even if server logout fails, clear client side and redirect
			try {
				session = null;
				user = null;
				userSession.set(null);

				if (browser) {
					Object.keys(localStorage).forEach((key) => {
						if (key.includes('supabase') || key.includes('sb-')) {
							localStorage.removeItem(key);
						}
					});
				}
				await supabase.auth.signOut();
			} catch (fallbackError) {
				console.error('🟢 Fallback logout also failed:', fallbackError);
			}

			// Ensure we always redirect even if there's an error
			loggingOut = false;
			window.location.href = '/login?message=logout-error';
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

	let showPasswordBanner = $state(false);

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

	// Function to restore window layout when using Chrome extension
	function restoreWindowLayout(): void {
		console.log('🪟 Restore window layout requested');

		// Type guard for Chrome extension API
		const chromeApi = (window as any).chrome;

		// More detailed checking
		console.log('🔍 Checking Chrome API availability:', {
			chromeExists: !!chromeApi,
			runtimeExists: !!(chromeApi && chromeApi.runtime),
			extensionId: chromeApi?.runtime?.id
		});

		if (browser && chromeApi && chromeApi.runtime && chromeApi.runtime.id) {
			try {
				console.log('🔌 Attempting to send message to extension...');

				// Send message to Chrome extension to restore layout
				chromeApi.runtime.sendMessage({ action: 'restoreWindowLayout' }, (response: any) => {
					console.log('📨 Extension response received:', response);

					if (chromeApi.runtime.lastError) {
						console.log('❌ Extension error:', chromeApi.runtime.lastError.message);
						showToast('Extension error: ' + chromeApi.runtime.lastError.message, 'error');
					} else if (response && response.success) {
						console.log('✅ Window layout restore successful');
						showToast('Window layout restored', 'success');

						// Hide the restore button after use
						const restoreBtn = document.getElementById('restore-window-btn');
						if (restoreBtn) {
							restoreBtn.style.display = 'none';
						}
					} else {
						console.log('⚠️ Extension response indicates failure:', response);
						showToast('Extension did not confirm restore', 'warning');
					}
				});
			} catch (error) {
				console.error('❌ Error sending message to extension:', error);
				showToast('Failed to communicate with extension', 'error');
			}
		} else {
			const reason = !browser
				? 'not in browser'
				: !chromeApi
					? 'Chrome API not found'
					: !chromeApi.runtime
						? 'Chrome runtime not found'
						: !chromeApi.runtime.id
							? 'Extension not active'
							: 'unknown';

			console.log('❌ Extension not available:', reason);
			showToast(`Extension not available: ${reason}`, 'info');
		}
	}

	// Show/hide restore button based on extension activity
	$effect(() => {
		if (browser) {
			// Listen for messages from Chrome extension
			const handleExtensionMessage = (event: any) => {
				if (event.data?.type === 'EXTENSION_WINDOW_SPLIT') {
					const restoreBtn = document.getElementById('restore-window-btn');
					if (restoreBtn) {
						restoreBtn.style.display = 'inline-flex';
					}
				}
			};

			window.addEventListener('message', handleExtensionMessage);

			return () => {
				window.removeEventListener('message', handleExtensionMessage);
			};
		}
	});

	// Make sure this reactive statement is typed properly
	$effect(() => {
		if (browser) {
			if (showPasswordBanner === true) {
				document.body.style.paddingTop = '33px';
			} else {
				document.body.style.paddingTop = '0';
			}
		}
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Material+Icons+Outlined&display=swap"
		rel="stylesheet"
	/>
	<script
		defer
		src="https://cloud.umami.is/script.js"
		data-website-id="22acb77e-4bb1-47a2-8305-7952ac07e62e"
	></script>
</svelte:head>

<div class="app-container" class:has-banner={showPasswordBanner}>
	<Sidebar.Provider class="" style="">
		<AppSidebar {user} />
		<main class="sidebar-main">
			<header class="site-header">
				<div class="header-left">
					<Sidebar.Trigger class="" onclick={() => {}} />
					<button
						class="restore-window-button"
						onclick={restoreWindowLayout}
						title="Restore Original Window Layout"
						style="display: none;"
						id="restore-window-btn"
					>
						<i class="material-icons-outlined">restore</i>
					</button>
				</div>
				<div class="header-right">
					{#if $syncStore.syncing || $syncStore.status}
						<div
							class="flex items-center gap-3 mr-4 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200"
						>
							{#if $syncStore.syncing}
								<div
									class="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent"
								></div>
							{/if}
							<div class="flex flex-col items-end leading-none gap-0.5">
								<span class="font-medium">{$syncStore.status}</span>
								{#if $syncStore.duration > 0}
									<span class="text-[10px] text-gray-500">{$syncStore.duration.toFixed(1)}s</span>
								{/if}
							</div>
						</div>
					{/if}
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
				{@render children()}
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

	.restore-window-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		background: white;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 14px;
		padding: 0;
	}

	.restore-window-button:hover {
		background: #f9fafb;
		color: #374151;
		border-color: #d1d5db;
	}

	.restore-window-button:active {
		background: #f3f4f6;
		transform: translateY(1px);
	}

	.restore-window-button i {
		font-size: 18px;
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
