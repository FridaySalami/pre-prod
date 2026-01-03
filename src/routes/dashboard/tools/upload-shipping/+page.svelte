<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/shadcn/ui/button';
	import { Input } from '$lib/shadcn/ui/input';
	import { Label } from '$lib/shadcn/ui/label';
	import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-svelte';

	export let form;

	let loading = false;
</script>

<div class="container mx-auto py-10">
	<div class="rounded-lg border bg-card text-card-foreground shadow-sm max-w-2xl mx-auto">
		<div class="flex flex-col space-y-1.5 p-6">
			<h3 class="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
				<FileSpreadsheet class="h-6 w-6" />
				Upload Shipping Costs
			</h3>
			<p class="text-sm text-muted-foreground">
				Upload the CSV file from Amazon Shipping to update order shipping costs. The file must
				contain "Reference #" (Order ID) and "Label Cost(GBP)".
			</p>
		</div>
		<div class="p-6 pt-0">
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
				class="space-y-6"
			>
				<div class="grid w-full max-w-sm items-center gap-1.5">
					<Label for="csv">Shipping CSV File</Label>
					<Input id="csv" name="csv" type="file" accept=".csv" required />
				</div>

				<Button type="submit" disabled={loading} class="w-full">
					{#if loading}
						<Upload class="mr-2 h-4 w-4 animate-bounce" />
						Processing...
					{:else}
						<Upload class="mr-2 h-4 w-4" />
						Upload and Process
					{/if}
				</Button>
			</form>

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
