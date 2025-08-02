<!-- src/routes/auth/auth-code-error/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';

	function tryAgain() {
		goto('/login');
	}
</script>

<div class="error-container">
	<h1>Authentication Error</h1>
	<p>There was an error processing your authentication. This might happen if:</p>
	<ul>
		<li>The authentication link has expired</li>
		<li>The link has already been used</li>
		<li>There was a network issue</li>
	</ul>

	<button onclick={tryAgain} class="retry-button"> Try Logging In Again </button>
</div>

<style>
	.error-container {
		max-width: 500px;
		margin: 4rem auto;
		padding: 2rem;
		text-align: center;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		background: #fff;
	}

	h1 {
		color: #dc2626;
		margin-bottom: 1rem;
	}

	ul {
		text-align: left;
		margin: 1rem 0;
	}

	.retry-button {
		background-color: #004225;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 1rem;
		margin-top: 1rem;
	}

	.retry-button:hover {
		background-color: #006339;
	}
</style>
