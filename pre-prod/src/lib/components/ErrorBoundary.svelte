<!-- Error Boundary component for Schedule page -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	export let title = 'Something went wrong';
	export let showDetails = false;
	export let retryAction: (() => void) | null = null;

	const dispatch = createEventDispatcher();

	let errorDetails = '';
	let showReportForm = false;
	let reportDescription = '';

	// Global error handler
	function handleGlobalError(event: ErrorEvent) {
		console.error('Global error caught:', event.error);
		errorDetails = event.error?.stack || event.error?.message || 'Unknown error';
		dispatch('error', { error: event.error, context: 'global' });
	}

	function handleUnhandledRejection(event: PromiseRejectionEvent) {
		console.error('Unhandled promise rejection:', event.reason);
		errorDetails = event.reason?.stack || event.reason?.message || 'Promise rejection';
		dispatch('error', { error: event.reason, context: 'promise' });
	}

	onMount(() => {
		window.addEventListener('error', handleGlobalError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleGlobalError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	});

	function toggleDetails() {
		showDetails = !showDetails;
	}

	function retry() {
		if (retryAction) {
			retryAction();
		}
	}

	function reportError() {
		showReportForm = true;
	}

	function submitReport() {
		// Here you would send the error report to your logging service
		console.log('Error report submitted:', {
			errorDetails,
			userDescription: reportDescription,
			timestamp: new Date().toISOString(),
			userAgent: navigator.userAgent,
			url: window.location.href
		});

		showReportForm = false;
		reportDescription = '';
	}
</script>

<div class="error-boundary">
	<div class="error-icon">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="48"
			height="48"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12.01" y2="8"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
	</div>

	<h2>{title}</h2>
	<p>
		We're sorry, but something unexpected happened. Please try refreshing the page or contact
		support if the problem persists.
	</p>

	<div class="error-actions">
		{#if retryAction}
			<button class="retry-button" on:click={retry}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 2v6h-6"></path>
					<path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
					<path d="M3 12a9 9 0 0 0 15 6.7l-3-2.7"></path>
				</svg>
				Try Again
			</button>
		{/if}

		<button class="details-button" on:click={toggleDetails}>
			{showDetails ? 'Hide' : 'Show'} Details
		</button>

		<button class="report-button" on:click={reportError}> Report Issue </button>
	</div>

	{#if showDetails && errorDetails}
		<div class="error-details">
			<h3>Technical Details:</h3>
			<pre>{errorDetails}</pre>
		</div>
	{/if}

	{#if showReportForm}
		<div class="report-form">
			<h3>Report This Issue</h3>
			<p>Help us fix this problem by describing what you were doing when it occurred.</p>

			<textarea
				bind:value={reportDescription}
				placeholder="Describe what you were doing when this error occurred..."
				rows="4"
			></textarea>

			<div class="report-actions">
				<button class="cancel-button" on:click={() => (showReportForm = false)}> Cancel </button>
				<button class="submit-button" on:click={submitReport}> Send Report </button>
			</div>
		</div>
	{/if}
</div>

<style>
	.error-boundary {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		background: #fef2f2;
		border: 1px solid #fee2e2;
		border-radius: 12px;
		margin: 2rem;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.error-icon {
		color: #ef4444;
		margin-bottom: 1rem;
	}

	h2 {
		color: #991b1b;
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	p {
		color: #7f1d1d;
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	.error-actions {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.retry-button,
	.details-button,
	.report-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.retry-button {
		background: #3b82f6;
		color: white;
	}

	.retry-button:hover {
		background: #2563eb;
	}

	.details-button {
		background: #6b7280;
		color: white;
	}

	.details-button:hover {
		background: #4b5563;
	}

	.report-button {
		background: #f59e0b;
		color: white;
	}

	.report-button:hover {
		background: #d97706;
	}

	.error-details {
		width: 100%;
		background: #f3f4f6;
		border-radius: 6px;
		padding: 1rem;
		margin-top: 1rem;
		text-align: left;
	}

	.error-details h3 {
		margin: 0 0 0.5rem 0;
		color: #374151;
		font-size: 1rem;
	}

	.error-details pre {
		background: white;
		padding: 0.75rem;
		border-radius: 4px;
		overflow-x: auto;
		font-size: 0.8rem;
		color: #1f2937;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.report-form {
		width: 100%;
		background: #f9fafb;
		border-radius: 8px;
		padding: 1.5rem;
		margin-top: 1rem;
		text-align: left;
	}

	.report-form h3 {
		margin: 0 0 0.5rem 0;
		color: #374151;
	}

	.report-form p {
		margin: 0 0 1rem 0;
		color: #6b7280;
		font-size: 0.9rem;
	}

	.report-form textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-family: inherit;
		font-size: 0.9rem;
		resize: vertical;
		min-height: 100px;
	}

	.report-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 1rem;
		justify-content: flex-end;
	}

	.cancel-button,
	.submit-button {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.cancel-button {
		background: #e5e7eb;
		color: #374151;
	}

	.cancel-button:hover {
		background: #d1d5db;
	}

	.submit-button {
		background: #3b82f6;
		color: white;
	}

	.submit-button:hover {
		background: #2563eb;
	}
</style>
