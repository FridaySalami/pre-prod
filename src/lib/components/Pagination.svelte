<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	interface Props {
		currentPage: number;
		totalPages: number;
		pageSize: number;
		totalProducts: number;
		hasNext: boolean;
		hasPrev: boolean;
		showing: {
			from: number;
			to: number;
		};
	}

	let { currentPage, totalPages, pageSize, totalProducts, hasNext, hasPrev, showing }: Props =
		$props();

	// Generate page numbers to display
	const pageNumbers = $derived.by(() => {
		const pages: (number | string)[] = [];
		const delta = 2; // Pages to show on each side of current page

		if (totalPages <= 7) {
			// Show all pages if 7 or fewer
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			// Calculate range around current page
			let start = Math.max(2, currentPage - delta);
			let end = Math.min(totalPages - 1, currentPage + delta);

			// Add ellipsis after first page if needed
			if (start > 2) {
				pages.push('...');
			}

			// Add pages around current page
			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			// Add ellipsis before last page if needed
			if (end < totalPages - 1) {
				pages.push('...');
			}

			// Always show last page
			pages.push(totalPages);
		}

		return pages;
	});

	function navigateToPage(newPage: number) {
		if (newPage < 1 || newPage > totalPages) return;

		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
		goto(url.toString());
	}

	function changePageSize(newSize: number) {
		const url = new URL($page.url);
		url.searchParams.set('pageSize', newSize.toString());
		url.searchParams.set('page', '1'); // Reset to first page
		goto(url.toString());
	}

	let jumpToPage = $state('');

	function handleJumpToPage() {
		const pageNum = parseInt(jumpToPage);
		if (pageNum >= 1 && pageNum <= totalPages) {
			navigateToPage(pageNum);
			jumpToPage = '';
		}
	}
</script>

<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
	<!-- Mobile view -->
	<div class="flex-1 flex justify-between sm:hidden">
		<button
			onclick={() => navigateToPage(currentPage - 1)}
			disabled={!hasPrev}
			class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Previous
		</button>
		<button
			onclick={() => navigateToPage(currentPage + 1)}
			disabled={!hasNext}
			class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Next
		</button>
	</div>

	<!-- Desktop view -->
	<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
		<div class="flex items-center gap-4">
			<!-- Results count -->
			<div>
				<p class="text-sm text-gray-700">
					Showing
					<span class="font-medium">{showing.from.toLocaleString()}</span>
					to
					<span class="font-medium">{showing.to.toLocaleString()}</span>
					of
					<span class="font-medium">{totalProducts.toLocaleString()}</span>
					products
				</p>
			</div>

			<!-- Page size selector -->
			<div class="flex items-center gap-2">
				<label for="pageSize" class="text-sm text-gray-700">Show:</label>
				<select
					id="pageSize"
					value={pageSize}
					onchange={(e) => changePageSize(parseInt(e.currentTarget.value))}
					class="block rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
				>
					<option value="25">25</option>
					<option value="50">50</option>
					<option value="100">100</option>
					<option value="250">250</option>
				</select>
			</div>

			<!-- Jump to page -->
			<div class="flex items-center gap-2">
				<label for="jumpToPage" class="text-sm text-gray-700">Go to:</label>
				<input
					id="jumpToPage"
					type="number"
					min="1"
					max={totalPages}
					bind:value={jumpToPage}
					onkeydown={(e) => e.key === 'Enter' && handleJumpToPage()}
					placeholder={currentPage.toString()}
					class="block w-20 rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
				/>
				<button
					onclick={handleJumpToPage}
					class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
				>
					Go
				</button>
			</div>
		</div>

		<!-- Page numbers -->
		<div>
			<nav
				class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
				aria-label="Pagination"
			>
				<!-- Previous button -->
				<button
					onclick={() => navigateToPage(currentPage - 1)}
					disabled={!hasPrev}
					class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<span class="sr-only">Previous</span>
					<svg
						class="h-5 w-5"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>

				<!-- Page numbers -->
				{#each pageNumbers as pageNum}
					{#if typeof pageNum === 'number'}
						<button
							onclick={() => navigateToPage(pageNum)}
							class={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
								pageNum === currentPage
									? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
									: 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
							}`}
						>
							{pageNum}
						</button>
					{:else}
						<span
							class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
						>
							{pageNum}
						</span>
					{/if}
				{/each}

				<!-- Next button -->
				<button
					onclick={() => navigateToPage(currentPage + 1)}
					disabled={!hasNext}
					class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<span class="sr-only">Next</span>
					<svg
						class="h-5 w-5"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</nav>
		</div>
	</div>
</div>
