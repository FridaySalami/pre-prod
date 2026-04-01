<script lang="ts">
	import { aiAssistantStore } from '$lib/stores/aiAssistantStore';

	// Subscribe to store
	let assistantState = $state($aiAssistantStore);
	$effect(() => {
		assistantState = $aiAssistantStore;
	});

	// Computed values
	const hasData = $derived(assistantState.currentData !== null);
	const isVisible = $derived(assistantState.isVisible);
	const shouldShow = $derived(hasData && !isVisible);

	function openAssistant() {
		aiAssistantStore.show();
	}
</script>

{#if shouldShow}
	<button
		onclick={openAssistant}
		class="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
		title="Open AI Data Assistant"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
			/>
		</svg>

		<!-- Pulse animation indicator -->
		<div
			class="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 animate-ping opacity-20"
		></div>

		<!-- Tooltip -->
		<div
			class="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
		>
			Ask AI about your data
			<div
				class="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
			></div>
		</div>
	</button>
{/if}
