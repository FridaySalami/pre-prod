<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { onMount, onDestroy } from 'svelte';

	export let sessionId: string;
	export let show: boolean = false;
	export let allowCancel: boolean = true;

	const dispatch = createEventDispatcher();

	let progress = 0;
	let processed = 0;
	let total = 0;
	let status = 'processing';
	let message = 'Starting upload...';
	let elapsed = 0;
	let remaining = 0;
	let eventSource: EventSource | null = null;

	$: progressPercent = Math.round(progress * 100) / 100;
	$: eta = remaining > 0 ? formatTime(remaining) : 'Calculating...';
	$: elapsedTime = formatTime(elapsed);
	$: isComplete = status === 'completed';
	$: isError = status === 'error';
	$: isCancelled = status === 'cancelled';
	$: canCancel = allowCancel && status === 'processing';

	function formatTime(milliseconds: number): string {
		const seconds = Math.floor(milliseconds / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	function connectToProgress() {
		if (!sessionId) return;

		const url = `/api/upload-progress?sessionId=${sessionId}`;
		eventSource = new EventSource(url);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				if (data.type === 'progress') {
					progress = data.progress || 0;
					processed = data.processed || 0;
					total = data.total || 0;
					status = data.status || 'processing';
					message = data.message || 'Processing...';
					elapsed = data.elapsed || 0;
					remaining = data.remaining || 0;

					dispatch('progress', {
						progress,
						processed,
						total,
						status,
						message,
						elapsed,
						remaining
					});

					if (status === 'completed') {
						dispatch('complete', { processed, total, message });
					} else if (status === 'error') {
						dispatch('error', { message });
					} else if (status === 'cancelled') {
						dispatch('cancelled', { message });
					}
				}
			} catch (error) {
				console.error('Error parsing progress data:', error);
			}
		};

		eventSource.onerror = (error) => {
			console.error('EventSource error:', error);
			dispatch('error', { message: 'Connection to progress updates lost' });
		};
	}

	function disconnectFromProgress() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	}

	async function cancelUpload() {
		if (!sessionId) return;

		try {
			const response = await fetch(`/api/upload-progress/cancel`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ sessionId })
			});

			if (response.ok) {
				status = 'cancelled';
				message = 'Upload cancelled by user';
				dispatch('cancelled', { message });
			}
		} catch (error) {
			console.error('Error cancelling upload:', error);
		}
	}

	function close() {
		dispatch('close');
	}

	onMount(() => {
		if (show && sessionId) {
			connectToProgress();
		}
	});

	onDestroy(() => {
		disconnectFromProgress();
	});

	$: if (show && sessionId && !eventSource) {
		connectToProgress();
	} else if (!show && eventSource) {
		disconnectFromProgress();
	}
</script>

{#if show}
	<div class="upload-progress-overlay" role="dialog" aria-modal="true">
		<div class="upload-progress-modal">
			<div class="upload-progress-header">
				<h3>Upload Progress</h3>
				{#if isComplete || isError || isCancelled}
					<button class="close-button" on:click={close} aria-label="Close">
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				{/if}
			</div>

			<div class="upload-progress-content">
				<div class="progress-bar-container">
					<div class="progress-bar">
						<div
							class="progress-fill {isComplete
								? 'complete'
								: isError
									? 'error'
									: isCancelled
										? 'cancelled'
										: ''}"
							style="width: {progressPercent}%"
						></div>
					</div>
					<div class="progress-text">
						{progressPercent}% ({processed.toLocaleString()} / {total.toLocaleString()} items)
					</div>
				</div>

				<div class="progress-status">
					<div
						class="status-message"
						class:error={isError}
						class:success={isComplete}
						class:cancelled={isCancelled}
					>
						{message}
					</div>

					{#if status === 'processing'}
						<div class="time-info">
							<span>Elapsed: {elapsedTime}</span>
							<span>ETA: {eta}</span>
						</div>
					{/if}
				</div>

				<div class="progress-actions">
					{#if canCancel}
						<button class="cancel-button" on:click={cancelUpload}> Cancel Upload </button>
					{/if}

					{#if isComplete}
						<button class="complete-button" on:click={close}> Done </button>
					{/if}

					{#if isError}
						<button class="error-button" on:click={close}> Close </button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.upload-progress-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.upload-progress-modal {
		background: white;
		border-radius: 8px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.upload-progress-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 1px solid #eee;
	}

	.upload-progress-header h3 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		color: #666;
		transition: background-color 0.2s;
	}

	.close-button:hover {
		background: #f0f0f0;
	}

	.upload-progress-content {
		padding: 20px;
	}

	.progress-bar-container {
		margin-bottom: 20px;
	}

	.progress-bar {
		width: 100%;
		height: 20px;
		background: #f0f0f0;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 8px;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #4f46e5, #7c3aed);
		border-radius: 10px;
		transition: width 0.3s ease;
		position: relative;
	}

	.progress-fill.complete {
		background: linear-gradient(90deg, #10b981, #059669);
	}

	.progress-fill.error {
		background: linear-gradient(90deg, #ef4444, #dc2626);
	}

	.progress-fill.cancelled {
		background: linear-gradient(90deg, #6b7280, #4b5563);
	}

	.progress-text {
		text-align: center;
		font-size: 0.9rem;
		color: #666;
		font-weight: 500;
	}

	.progress-status {
		margin-bottom: 20px;
	}

	.status-message {
		font-size: 0.95rem;
		margin-bottom: 10px;
		padding: 8px;
		border-radius: 4px;
		background: #f8fafc;
		border-left: 4px solid #4f46e5;
	}

	.status-message.success {
		background: #f0fdf4;
		border-left-color: #10b981;
		color: #047857;
	}

	.status-message.error {
		background: #fef2f2;
		border-left-color: #ef4444;
		color: #dc2626;
	}

	.status-message.cancelled {
		background: #f9fafb;
		border-left-color: #6b7280;
		color: #4b5563;
	}

	.time-info {
		display: flex;
		justify-content: space-between;
		font-size: 0.85rem;
		color: #666;
	}

	.progress-actions {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}

	.cancel-button,
	.complete-button,
	.error-button {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.cancel-button {
		background: #f3f4f6;
		color: #374151;
	}

	.cancel-button:hover {
		background: #e5e7eb;
	}

	.complete-button {
		background: #10b981;
		color: white;
	}

	.complete-button:hover {
		background: #059669;
	}

	.error-button {
		background: #ef4444;
		color: white;
	}

	.error-button:hover {
		background: #dc2626;
	}
</style>
