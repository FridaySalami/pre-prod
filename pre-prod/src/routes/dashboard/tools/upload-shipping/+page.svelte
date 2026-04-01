<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/shadcn/ui/button';
	import { Input } from '$lib/shadcn/ui/input';
	import { Label } from '$lib/shadcn/ui/label';
	import {
		Upload,
		FileSpreadsheet,
		AlertCircle,
		CheckCircle,
		RefreshCw,
		Download
	} from 'lucide-svelte';

	export let form;

	let loading = false;

	// Debug helper
	$: if (form) console.log('Form updated:', form);
</script>

<div class="container mx-auto py-10">
	<div class="rounded-lg border bg-card text-card-foreground shadow-sm max-w-2xl mx-auto">
		<div class="flex flex-col space-y-1.5 p-6">
			<h3 class="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
				<FileSpreadsheet class="h-6 w-6" />
				Shipping Costs Manager
			</h3>
			<p class="text-sm text-muted-foreground">Sync shipping costs from Amazon Shipping.</p>
		</div>
		<div class="p-6 pt-0 space-y-8">
			{#if form?.success}
				<div
					class="w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 border-green-500 bg-green-50 text-green-900 relative"
				>
					<CheckCircle class="h-4 w-4 absolute left-4 top-4 text-green-600" />
					<h5 class="mb-1 font-medium leading-none tracking-tight text-green-900">Sync Complete</h5>
					<div class="text-sm text-green-800 mt-2">
						{#if form.stats}
							<div class="grid grid-cols-2 gap-2 mb-2 text-xs font-medium">
								<div class="flex flex-col bg-white/60 p-2 rounded border border-green-100">
									<span class="text-green-700/70 uppercase text-[10px]">Found in CSV</span>
									<span class="text-lg text-green-900">{form.stats.totalFound}</span>
								</div>
								<div class="flex flex-col bg-white/60 p-2 rounded border border-green-100">
									<span class="text-green-700/70 uppercase text-[10px]">Matches in DB</span>
									<span class="text-lg text-green-900"
										>{form.stats.verifiedInDb}
										<span class="text-xs text-green-700 font-normal">({form.stats.matchRate})</span
										></span
									>
								</div>
								<div
									class="flex flex-col bg-white/60 p-2 rounded col-span-2 border border-green-100"
								>
									<span class="text-green-700/70 uppercase text-[10px]">Updated Records</span>
									<span class="text-lg text-green-700">{form.stats.updated}</span>
								</div>
							</div>
						{/if}
						<p>{form.message}</p>
					</div>
				</div>
			{/if}

			{#if form?.error}
				<div
					class="w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive relative"
				>
					<AlertCircle class="h-4 w-4" />
					<h5 class="mb-1 font-medium leading-none tracking-tight">Error</h5>
					<div class="text-sm [&_p]:leading-relaxed">{form.error}</div>
				</div>
			{/if}

			<!-- Automated Section -->
			<div class="space-y-4 border-b pb-6">
				<h4 class="font-medium flex items-center gap-2">
					<RefreshCw class="h-4 w-4" />
					Automated Sync
				</h4>
				<p class="text-xs text-muted-foreground">
					Automatically launches a browser, downloads the last 3 days (Today + 2 previous), and
					updates costs.
					<br />
					<strong>Note:</strong> You may need to log in to Amazon Shipping in the opened browser window.
				</p>
				<form
					method="POST"
					action="?/download_sync"
					use:enhance={() => {
						loading = true;
						return async ({ result, update }) => {
							console.log('Sync Result:', result);
							await update();
							loading = false;
						};
					}}
				>
					<Button
						type="submit"
						disabled={loading}
						variant="default"
						class="w-full bg-blue-600 hover:bg-blue-700 text-white"
					>
						{#if loading}
							<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
							Syncing...
						{:else}
							<Download class="mr-2 h-4 w-4" />
							Download & Sync (Last 3 Days)
						{/if}
					</Button>
				</form>
			</div>

			<!-- Manual Section -->
			<div class="space-y-4">
				<h4 class="font-medium flex items-center gap-2">
					<Upload class="h-4 w-4" />
					Manual Upload
				</h4>
				<p class="text-xs text-muted-foreground">Manually upload a previously downloaded report.</p>
				<form
					method="POST"
					action="?/upload"
					enctype="multipart/form-data"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-4"
				>
					<div class="grid w-full max-w-sm items-center gap-1.5">
						<Label for="csv">Shipping File (CSV or Excel)</Label>
						<Input id="csv" name="csv" type="file" accept=".csv, .xlsx, .xls" required />
					</div>

					<Button type="submit" disabled={loading} variant="outline" class="w-full">
						{#if loading}
							<Upload class="mr-2 h-4 w-4 animate-bounce" />
							Processing...
						{:else}
							<Upload class="mr-2 h-4 w-4" />
							Upload File
						{/if}
					</Button>
				</form>
			</div>

			{#if form?.success}
				<div
					class="relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground mt-6 border-green-500 bg-green-50 text-green-900"
				>
					<CheckCircle class="h-4 w-4" />
					<h5 class="mb-1 font-medium leading-none tracking-tight">Success</h5>
					<div class="text-sm [&_p]:leading-relaxed">
						{form.message}
						<br />
						Updated {form.updatedCount} orders.
					</div>
				</div>
			{/if}

			{#if form?.error}
				<div
					class="relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 mt-6 border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"
				>
					<AlertCircle class="h-4 w-4" />
					<h5 class="mb-1 font-medium leading-none tracking-tight">Error</h5>
					<div class="text-sm [&_p]:leading-relaxed">{form.error}</div>
				</div>
			{/if}

			{#if form?.details}
				<div class="mt-4 p-4 bg-slate-100 rounded-md text-xs font-mono overflow-auto max-h-60">
					<pre>{JSON.stringify(form.details, null, 2)}</pre>
				</div>
			{/if}
		</div>
	</div>
</div>
