<script lang="ts">
	import { onMount } from 'svelte';

	interface TestResult {
		suite: string;
		test: string;
		status: 'pass' | 'fail';
		error?: string;
	}

	// Import the test suite
	let testResults: TestResult[] = [];
	let isRunning = false;
	let completed = false;

	onMount(async () => {
		// Test page loaded - no automatic tests running
		console.log('Test page loaded');
		completed = true;
	});

	function runTests() {
		isRunning = true;
		completed = false;

		// Reload the test module to run fresh tests
		import('../schedules/schedule-page.test.js?' + Date.now()).then(() => {
			setTimeout(() => {
				isRunning = false;
				completed = true;
			}, 1000);
		});
	}
</script>

<svelte:head>
	<title>Schedule Page Tests</title>
</svelte:head>

<div class="test-page">
	<h1>🧪 Schedule Page Test Suite</h1>

	<div class="test-controls">
		<button on:click={runTests} disabled={isRunning}>
			{isRunning ? 'Running Tests...' : 'Run Tests'}
		</button>

		{#if completed}
			<span class="status">✅ Tests Completed</span>
		{/if}
	</div>

	<div class="instructions">
		<h2>📋 How to View Test Results</h2>
		<ol>
			<li><strong>Open Browser Console</strong> (F12 → Console tab)</li>
			<li><strong>Click "Run Tests"</strong> button above</li>
			<li><strong>Check Console Output</strong> for detailed results</li>
		</ol>

		<h3>🔍 What Gets Tested</h3>
		<ul>
			<li><strong>Input Validation</strong> - Employee names, schedule data, leave requests</li>
			<li><strong>Performance Monitoring</strong> - Load times, memory usage, API calls</li>
			<li><strong>Error Handling</strong> - API errors, resource cleanup, retry logic</li>
			<li><strong>Accessibility</strong> - ARIA labels, keyboard navigation, reduced motion</li>
			<li><strong>Data Management</strong> - Caching, API responses, data transformation</li>
		</ul>
	</div>

	<div class="console-info">
		<h3>💡 Console Commands</h3>
		<p>You can run test commands manually in the browser console:</p>
		<pre><code
				>// Run specific commands
console.log('Check console output for test results');</code
			></pre>
	</div>

	{#if testResults.length > 0}
		<div class="results-summary">
			<h3>📊 Test Results</h3>
			<div class="results-grid">
				{#each testResults as result}
					<div
						class="result-item"
						class:pass={result.status === 'pass'}
						class:fail={result.status === 'fail'}
					>
						<span class="status-icon">{result.status === 'pass' ? '✅' : '❌'}</span>
						<span class="suite">{result.suite}</span>
						<span class="test">{result.test}</span>
						{#if result.error}
							<span class="error">{result.error}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.test-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	h1 {
		color: #2563eb;
		margin-bottom: 2rem;
		text-align: center;
	}

	.test-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
		padding: 1rem;
		background: #f8fafc;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
	}

	button {
		background: #2563eb;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.375rem;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	button:hover:not(:disabled) {
		background: #1d4ed8;
	}

	button:disabled {
		background: #94a3b8;
		cursor: not-allowed;
	}

	.status {
		color: #059669;
		font-weight: 500;
	}

	.instructions {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
		margin-bottom: 2rem;
	}

	.instructions h2 {
		color: #1e293b;
		margin-top: 0;
	}

	.instructions h3 {
		color: #475569;
		margin-top: 1.5rem;
	}

	.instructions ol,
	.instructions ul {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.instructions li {
		margin: 0.5rem 0;
	}

	.console-info {
		background: #0f172a;
		color: #e2e8f0;
		padding: 1.5rem;
		border-radius: 0.5rem;
		margin-bottom: 2rem;
	}

	.console-info h3 {
		color: #38bdf8;
		margin-top: 0;
	}

	.console-info pre {
		background: #1e293b;
		padding: 1rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		margin: 1rem 0 0 0;
	}

	.console-info code {
		color: #94a3b8;
		font-family: 'Fira Code', 'Consolas', monospace;
		font-size: 0.875rem;
	}

	.results-summary {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
	}

	.results-grid {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.result-item {
		display: grid;
		grid-template-columns: auto 1fr 2fr auto;
		gap: 1rem;
		padding: 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.result-item.pass {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
	}

	.result-item.fail {
		background: #fef2f2;
		border: 1px solid #fecaca;
	}

	.suite {
		font-weight: 500;
		color: #475569;
	}

	.test {
		color: #1e293b;
	}

	.error {
		color: #dc2626;
		font-size: 0.75rem;
	}
</style>
