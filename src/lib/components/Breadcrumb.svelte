<script lang="ts">
	import { goto } from '$app/navigation';

	export let currentPage: string;
</script>

<!-- Breadcrumb Navigation -->
<div class="breadcrumb">
	<button class="breadcrumb-link" on:click={() => goto('/pricer')}>
		<i class="material-icons-outlined">arrow_back</i>
		Pricer Dashboard
	</button>
	<span class="breadcrumb-separator">/</span>
	<span class="breadcrumb-current">{currentPage}</span>
</div>

<style>
	/* Breadcrumb Navigation */
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 24px;
		font-size: 0.875rem;
	}

	.breadcrumb-link {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		color: #3b82f6;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.breadcrumb-link:hover {
		background: #f3f4f6;
		color: #1d4ed8;
	}

	.breadcrumb-link i {
		font-size: 1rem;
	}

	.breadcrumb-separator {
		color: #d1d5db;
		font-weight: 400;
	}

	.breadcrumb-current {
		color: #374151;
		font-weight: 500;
	}
</style>
