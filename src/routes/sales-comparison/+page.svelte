<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import type { SubmitFunction } from '@sveltejs/kit';

	export let form: ActionData;
	let loading = false;
	let emailLoading = false;

	const handleSubmit: SubmitFunction = () => {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	};

	async function sendEmail() {
		if (!form?.analysis) return;
		emailLoading = true;

		try {
			const summary = form.analysis.summary;
			const increases = form.analysis.top_movers?.sales_increases || [];
			const decreases = form.analysis.top_movers?.sales_decreases || [];
			const bbGains = form.analysis.top_movers?.buybox_increases || [];
			const bbDrops = form.analysis.top_movers?.buybox_decreases || [];
			const bbSalesGain = form.analysis.top_movers?.buybox_sales_gain || [];
			const bbSalesLost = form.analysis.top_movers?.buybox_sales_impact || [];

			// Helper to create table rows
			const createRow = (p: any, type: 'increase' | 'decrease' | 'bb' | 'bb-sales') => {
				let changeValue = '';
				let changeColor = '';
				let secondaryInfo = '';

				if (type === 'increase') {
					changeValue = `+£${p.Sales_Change.toFixed(2)}`;
					changeColor = '#059669'; // green
				} else if (type === 'decrease') {
					changeValue = `£${p.Sales_Change.toFixed(2)}`;
					changeColor = '#dc2626'; // red
				} else if (type === 'bb') {
					const isGain = p.BuyBox_Change > 0;
					changeValue = `${isGain ? '+' : ''}${p.BuyBox_Change.toFixed(1)}%`;
					changeColor = isGain ? '#059669' : '#dc2626';
					secondaryInfo = `<div style="font-size: 11px; color: #9ca3af;">Now ${p.New_BuyBox.toFixed(1)}%</div>`;
				} else if (type === 'bb-sales') {
					const isGain = p.Sales_Change > 0;
					changeValue = `${isGain ? '+' : ''}£${Math.abs(p.Sales_Change).toFixed(0)}`;
					changeColor = isGain ? '#059669' : '#dc2626';
					secondaryInfo = `<div style="font-size: 11px; color: ${changeColor};">BB ${p.BuyBox_Change > 0 ? '+' : ''}${p.BuyBox_Change.toFixed(1)}%</div>`;
				}

				return `
					<tr>
						<td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
							<div style="font-weight: bold; font-size: 14px;">${p.SKU}</div>
							<div style="font-size: 12px; color: #6b7280; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.Product_Title}</div>
						</td>
						<td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
							<div style="color: ${changeColor}; font-weight: bold;">${changeValue}</div>
							${secondaryInfo}
						</td>
					</tr>
				`;
			};

			// Build HTML email content
			const html = `
				<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
					<h1 style="color: #1a56db; text-align: center;">Sales Comparison Report</h1>
					<p style="text-align: center; color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
					
					<!-- Summary Section -->
					<div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
						<h2 style="margin-top: 0; color: #374151; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Performance Summary</h2>
						<table style="width: 100%; border-collapse: collapse;">
							<tr>
								<td style="padding: 8px 0;">Previous Total Sales:</td>
								<td style="text-align: right; font-weight: bold;">£${summary.total_old_sales.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0;">Current Total Sales:</td>
								<td style="text-align: right; font-weight: bold;">£${summary.total_new_sales.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
							</tr>
							<tr style="border-top: 1px solid #d1d5db;">
								<td style="padding: 8px 0;"><strong>Net Change:</strong></td>
								<td style="text-align: right; font-weight: bold; color: ${summary.total_change >= 0 ? '#059669' : '#dc2626'};">
									${summary.total_change >= 0 ? '+' : ''}£${summary.total_change.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									(${summary.total_change_percent >= 0 ? '+' : ''}${summary.total_change_percent.toFixed(1)}%)
								</td>
							</tr>
						</table>
					</div>

					<!-- Sales Movers -->
					<h3 style="color: #374151; background-color: #e5e7eb; padding: 10px; margin-top: 30px; margin-bottom: 0;">Top Sales Movers</h3>
					<div style="display: flex; gap: 20px;">
						<div style="flex: 1;">
							<h4 style="color: #059669; margin-bottom: 5px;">Biggest Increases</h4>
							<table style="width: 100%; border-collapse: collapse;">
								${increases
									.slice(0, 5)
									.map((p: any) => createRow(p, 'increase'))
									.join('')}
							</table>
						</div>
					</div>
					<div style="display: flex; gap: 20px; margin-top: 20px;">
						<div style="flex: 1;">
							<h4 style="color: #dc2626; margin-bottom: 5px;">Biggest Drops</h4>
							<table style="width: 100%; border-collapse: collapse;">
								${decreases
									.slice(0, 5)
									.map((p: any) => createRow(p, 'decrease'))
									.join('')}
							</table>
						</div>
					</div>

					<!-- Buy Box Impact -->
					<h3 style="color: #374151; background-color: #e5e7eb; padding: 10px; margin-top: 30px; margin-bottom: 0;">Buy Box Sales Impact</h3>
					${
						bbSalesGain.length > 0
							? `
						<h4 style="color: #059669; margin-bottom: 5px;">Sales Gained (BB Increase)</h4>
						<table style="width: 100%; border-collapse: collapse;">
							${bbSalesGain
								.slice(0, 5)
								.map((p: any) => createRow(p, 'bb-sales'))
								.join('')}
						</table>
					`
							: '<p style="font-style: italic; color: #9ca3af;">No major sales gains from Buy Box increases.</p>'
					}

					${
						bbSalesLost.length > 0
							? `
						<h4 style="color: #dc2626; margin-bottom: 5px; margin-top: 20px;">Sales Lost (BB Decrease)</h4>
						<table style="width: 100%; border-collapse: collapse;">
							${bbSalesLost
								.slice(0, 5)
								.map((p: any) => createRow(p, 'bb-sales'))
								.join('')}
						</table>
					`
							: ''
					}

					<!-- Top Buy Box Movers -->
					<h3 style="color: #374151; background-color: #e5e7eb; padding: 10px; margin-top: 30px; margin-bottom: 0;">Buy Box Stability</h3>
					<table style="width: 100%; border-collapse: collapse;">
						<tr>
							<td style="vertical-align: top; width: 50%; padding-right: 10px;">
								<h4 style="color: #059669; margin-bottom: 5px;">Biggest Gains</h4>
								<table style="width: 100%; border-collapse: collapse;">
									${bbGains
										.slice(0, 3)
										.map((p: any) => createRow(p, 'bb'))
										.join('')}
								</table>
							</td>
							<td style="vertical-align: top; width: 50%; padding-left: 10px;">
								<h4 style="color: #dc2626; margin-bottom: 5px;">Biggest Drops</h4>
								<table style="width: 100%; border-collapse: collapse;">
									${bbDrops
										.slice(0, 3)
										.map((p: any) => createRow(p, 'bb'))
										.join('')}
								</table>
							</td>
						</tr>
					</table>

					<div style="text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px;">
						<p>This report was automatically generated by the Sales Comparison Tool.</p>
					</div>
				</div>
			`;

			const attachments = [];
			if (form.excelReport) {
				attachments.push({
					filename: `weekly_sales_analysis_${new Date().toISOString().split('T')[0]}.xlsx`,
					content: form.excelReport
				});
			}

			const response = await fetch('/api/send-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					to: ['jack.w@parkersfoodservice.co.uk'], // Default recipient
					subject: `Sales Comparison Report - ${new Date().toLocaleDateString()}`,
					html,
					attachments
				})
			});

			const result = await response.json();

			if (response.ok) {
				alert('Report emailed successfully!');
			} else {
				alert(`Failed to send email: ${result.error || 'Unknown error'}`);
			}
		} catch (e) {
			console.error('Error sending email:', e);
			alert('An error occurred while sending the email.');
		} finally {
			emailLoading = false;
		}
	}

	function downloadExcel() {
		if (!form?.excelReport) return;

		const link = document.createElement('a');
		link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${form.excelReport}`;
		link.download = `weekly_sales_analysis_${new Date().toISOString().split('T')[0]}.xlsx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="container mx-auto p-6 max-w-7xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Sales Comparison Analysis</h1>
		<p class="text-gray-600">
			Upload two business reports to compare performance. The older report will be used as the
			baseline.
		</p>
	</div>

	<div class="bg-white rounded-lg shadow-md p-6 mb-8">
		<form method="POST" enctype="multipart/form-data" use:enhance={handleSubmit} class="space-y-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
				<div class="space-y-2">
					<label for="oldReport" class="block text-sm font-medium text-gray-700">
						Old Report (Baseline Week)
					</label>
					<div
						class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors"
					>
						<div class="space-y-1 text-center">
							<svg
								class="mx-auto h-12 w-12 text-gray-400"
								stroke="currentColor"
								fill="none"
								viewBox="0 0 48 48"
								aria-hidden="true"
							>
								<path
									d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							<div class="flex text-sm text-gray-600">
								<label
									for="oldReport"
									class="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
								>
									<span>Upload a file</span>
									<input
										id="oldReport"
										name="oldReport"
										type="file"
										accept=".csv"
										required
										class="sr-only"
									/>
								</label>
								<p class="pl-1">or drag and drop</p>
							</div>
							<p class="text-xs text-gray-500">CSV up to 10MB</p>
						</div>
					</div>
				</div>

				<div class="space-y-2">
					<label for="newReport" class="block text-sm font-medium text-gray-700">
						New Report (Current Week)
					</label>
					<div
						class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors"
					>
						<div class="space-y-1 text-center">
							<svg
								class="mx-auto h-12 w-12 text-gray-400"
								stroke="currentColor"
								fill="none"
								viewBox="0 0 48 48"
								aria-hidden="true"
							>
								<path
									d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							<div class="flex text-sm text-gray-600">
								<label
									for="newReport"
									class="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
								>
									<span>Upload a file</span>
									<input
										id="newReport"
										name="newReport"
										type="file"
										accept=".csv"
										required
										class="sr-only"
									/>
								</label>
								<p class="pl-1">or drag and drop</p>
							</div>
							<p class="text-xs text-gray-500">CSV up to 10MB</p>
						</div>
					</div>
				</div>
			</div>

			<div class="flex flex-col sm:flex-row justify-end gap-3">
				<button
					type="submit"
					formaction="?/analyzePython"
					disabled={loading}
					class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Compare (Python / Legacy)
				</button>

				<button
					type="submit"
					formaction="?/analyzeNode"
					disabled={loading}
					class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if loading}
						<svg
							class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Analyzing...
					{:else}
						Compare (Node / Production)
					{/if}
				</button>
			</div>
		</form>
	</div>

	{#if form?.error}
		<div class="bg-red-50 border-l-4 border-red-400 p-4 mb-8" role="alert">
			<div class="flex">
				<div class="shrink-0">
					<svg
						class="h-5 w-5 text-red-400"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-sm text-red-700">
						{form.error}
					</p>
				</div>
			</div>
		</div>
	{/if}

	{#if form?.success && form.analysis}
		<div class="flex justify-end mb-4 space-x-4">
			<button
				on:click={sendEmail}
				disabled={emailLoading}
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
			>
				{#if emailLoading}
					<svg
						class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Sending...
				{:else}
					<svg class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
					Email Report
				{/if}
			</button>

			{#if form.excelReport}
				<button
					on:click={downloadExcel}
					class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
				>
					<svg class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					Download Excel Report
				</button>
			{/if}
		</div>

		<div class="space-y-8">
			<!-- Summary Cards -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="px-4 py-5 sm:p-6">
						<dt class="text-sm font-medium text-gray-500 truncate">Previous Total Sales</dt>
						<dd class="mt-1 text-3xl font-semibold text-gray-900">
							£{form.analysis.summary.total_old_sales.toLocaleString('en-GB', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}
						</dd>
					</div>
				</div>
				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="px-4 py-5 sm:p-6">
						<dt class="text-sm font-medium text-gray-500 truncate">Current Total Sales</dt>
						<dd class="mt-1 text-3xl font-semibold text-gray-900">
							£{form.analysis.summary.total_new_sales.toLocaleString('en-GB', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}
						</dd>
					</div>
				</div>
				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="px-4 py-5 sm:p-6">
						<dt class="text-sm font-medium text-gray-500 truncate">Net Change</dt>
						<dd
							class="mt-1 text-3xl font-semibold {form.analysis.summary.total_change >= 0
								? 'text-green-600'
								: 'text-red-600'}"
						>
							{form.analysis.summary.total_change >= 0
								? '+'
								: ''}£{form.analysis.summary.total_change.toLocaleString('en-GB', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}
						</dd>
					</div>
				</div>
				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="px-4 py-5 sm:p-6">
						<dt class="text-sm font-medium text-gray-500 truncate">% Change</dt>
						<dd
							class="mt-1 text-3xl font-semibold {form.analysis.summary.total_change_percent >= 0
								? 'text-green-600'
								: 'text-red-600'}"
						>
							{form.analysis.summary.total_change_percent >= 0
								? '+'
								: ''}{form.analysis.summary.total_change_percent.toFixed(1)}%
						</dd>
					</div>
				</div>
			</div>

			<!-- New Top Line Analysis (Top Movers) -->
			{#if form.analysis.top_movers}
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<!-- Sales Movers -->
					<div class="bg-white shadow rounded-lg p-6">
						<h3 class="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Top Sales Movers</h3>

						<h4 class="text-sm font-semibold text-green-700 mt-2 mb-2">Biggest Increases</h4>
						<ul class="space-y-2 mb-4">
							{#each form.analysis.top_movers.sales_increases as product}
								<li class="flex justify-between items-start text-sm">
									<div class="flex flex-col flex-1 pr-2 overflow-hidden">
										<span class="text-gray-600 truncate" title={product.Product_Title}
											>{product.Product_Title}</span
										>
										<span class="text-xs text-gray-400">{product.SKU}</span>
									</div>
									<span class="font-medium text-green-600 whitespace-nowrap"
										>+{product.Sales_Change.toFixed(2)}</span
									>
								</li>
							{/each}
						</ul>

						<h4 class="text-sm font-semibold text-red-700 mt-2 mb-2">Biggest Drops</h4>
						<ul class="space-y-2">
							{#each form.analysis.top_movers.sales_decreases as product}
								<li class="flex justify-between items-start text-sm">
									<div class="flex flex-col flex-1 pr-2 overflow-hidden">
										<span class="text-gray-600 truncate" title={product.Product_Title}
											>{product.Product_Title}</span
										>
										<span class="text-xs text-gray-400">{product.SKU}</span>
									</div>
									<span class="font-medium text-red-600 whitespace-nowrap"
										>{product.Sales_Change.toFixed(2)}</span
									>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Buy Box Movers -->
					<div class="bg-white shadow rounded-lg p-6">
						<h3 class="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Buy Box Stability</h3>

						<h4 class="text-sm font-semibold text-green-700 mt-2 mb-2">Biggest Gains</h4>
						<ul class="space-y-2 mb-4">
							{#each form.analysis.top_movers.buybox_increases as product}
								<li class="flex justify-between items-start text-sm">
									<div class="flex flex-col flex-1 pr-2 overflow-hidden">
										<span class="text-gray-600 truncate" title={product.Product_Title}
											>{product.Product_Title}</span
										>
										<span class="text-xs text-gray-400">{product.SKU}</span>
									</div>
									<div class="text-right whitespace-nowrap">
										<div class="font-medium text-green-600">
											+{product.BuyBox_Change.toFixed(1)}%
										</div>
										<div class="text-xs text-gray-400">Now {product.New_BuyBox.toFixed(1)}%</div>
									</div>
								</li>
							{/each}
						</ul>

						<h4 class="text-sm font-semibold text-red-700 mt-2 mb-2">Biggest Drops</h4>
						<ul class="space-y-2">
							{#each form.analysis.top_movers.buybox_decreases as product}
								<li class="flex justify-between items-start text-sm">
									<div class="flex flex-col flex-1 pr-2 overflow-hidden">
										<span class="text-gray-600 truncate" title={product.Product_Title}
											>{product.Product_Title}</span
										>
										<span class="text-xs text-gray-400">{product.SKU}</span>
									</div>
									<div class="text-right whitespace-nowrap">
										<div class="font-medium text-red-600">{product.BuyBox_Change.toFixed(1)}%</div>
										<div class="text-xs text-gray-400">Now {product.New_BuyBox.toFixed(1)}%</div>
									</div>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Buy Box Impact -->
					<div class="bg-white shadow rounded-lg p-6 border-l-4 border-blue-400">
						<h3 class="text-lg font-medium text-gray-900 mb-4 border-b pb-2">
							Buy Box Sales Impact
						</h3>

						<!-- Positive Impact -->
						<h4 class="text-sm font-semibold text-green-700 mt-2 mb-2">
							Sales Gained (BB Increase)
						</h4>
						{#if form.analysis.top_movers.buybox_sales_gain && form.analysis.top_movers.buybox_sales_gain.length > 0}
							<ul class="space-y-3 mb-6">
								{#each form.analysis.top_movers.buybox_sales_gain as product}
									<li class="flex justify-between items-start text-sm bg-green-50 p-2 rounded">
										<div class="flex flex-col flex-1 pr-2 overflow-hidden">
											<span class="text-gray-700 truncate font-medium" title={product.Product_Title}
												>{product.Product_Title}</span
											>
											<span class="text-xs text-gray-500">{product.SKU}</span>
										</div>
										<div class="text-right whitespace-nowrap">
											<div class="font-bold text-green-600">
												+£{product.Sales_Change.toFixed(0)}
											</div>
											<div class="text-xs text-green-600">
												BB +{product.BuyBox_Change.toFixed(1)}%
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-xs text-gray-400 italic text-center py-2 mb-6">
								No major sales gains correlated with Buy Box increases.
							</p>
						{/if}

						<!-- Negative Impact -->
						<h4 class="text-sm font-semibold text-red-700 mt-2 mb-2">Sales Lost (BB Decrease)</h4>
						{#if form.analysis.top_movers.buybox_sales_impact.length > 0}
							<ul class="space-y-3">
								{#each form.analysis.top_movers.buybox_sales_impact as product}
									<li class="flex justify-between items-start text-sm bg-red-50 p-2 rounded">
										<div class="flex flex-col flex-1 pr-2 overflow-hidden">
											<span class="text-gray-700 truncate font-medium" title={product.Product_Title}
												>{product.Product_Title}</span
											>
											<span class="text-xs text-gray-500">{product.SKU}</span>
										</div>
										<div class="text-right whitespace-nowrap">
											<div class="font-bold text-red-600">£{product.Sales_Change.toFixed(0)}</div>
											<div class="text-xs text-red-600">BB {product.BuyBox_Change.toFixed(1)}%</div>
										</div>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-xs text-gray-400 italic text-center py-2">
								No major sales losses correlated with Buy Box drops.
							</p>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Detailed Table -->
			<div class="bg-white shadow overflow-hidden rounded-lg">
				<div class="px-4 py-5 sm:px-6 flex justify-between items-center">
					<h3 class="text-lg leading-6 font-medium text-gray-900">Product Performance Review</h3>
					<span class="text-sm text-gray-500"
						>Showing {form.analysis.summary.product_count} products</span
					>
				</div>
				<div class="border-t border-gray-200 overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Product / SKU
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Old Sales
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									New Sales
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Change (£)
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Change (%)
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Page Views (Old → New)
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Conversion (Old → New)
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Buy Box (Old → New)
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Status
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each form.analysis.products as product}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4">
										<div
											class="text-sm font-medium text-gray-900 line-clamp-2"
											title={product.Product_Title}
										>
											{product.Product_Title}
										</div>
										<div class="text-sm text-gray-500">{product.SKU}</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
										£{product.Old_Sales.toFixed(2)}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium"
									>
										£{product.New_Sales.toFixed(2)}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold {product.Sales_Change >
										0
											? 'text-green-600'
											: product.Sales_Change < 0
												? 'text-red-600'
												: 'text-gray-500'}"
									>
										{product.Sales_Change > 0 ? '+' : ''}{product.Sales_Change.toFixed(2)}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm text-right {product.Sales_Change_Percent >
										0
											? 'text-green-600'
											: product.Sales_Change_Percent < 0
												? 'text-red-600'
												: 'text-gray-500'}"
									>
										{product.Sales_Change_Percent.toFixed(1)}%
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
										<div class="flex flex-col items-end">
											<span>{product.Old_Page_Views} → {product.New_Page_Views}</span>
											<span
												class="text-xs {product.Page_Views_Change > 0
													? 'text-green-600'
													: product.Page_Views_Change < 0
														? 'text-red-600'
														: 'text-gray-400'}"
											>
												{product.Page_Views_Change > 0 ? '+' : ''}{product.Page_Views_Change}
											</span>
										</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
										<div class="flex flex-col items-end">
											<span
												>{product.Old_Conversion.toFixed(1)}% → {product.New_Conversion.toFixed(
													1
												)}%</span
											>
											<span
												class="text-xs {product.Conversion_Change > 0
													? 'text-green-600'
													: product.Conversion_Change < 0
														? 'text-red-600'
														: 'text-gray-400'}"
											>
												{product.Conversion_Change > 0
													? '+'
													: ''}{product.Conversion_Change.toFixed(1)}%
											</span>
										</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
										<div class="flex flex-col items-end">
											<span
												>{product.Old_BuyBox.toFixed(1)}% → {product.New_BuyBox.toFixed(1)}%</span
											>
											<span
												class="text-xs {product.BuyBox_Change > 0
													? 'text-green-600'
													: product.BuyBox_Change < 0
														? 'text-red-600'
														: 'text-gray-400'}"
											>
												{product.BuyBox_Change > 0 ? '+' : ''}{product.BuyBox_Change.toFixed(1)}%
											</span>
										</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-center">
										<span
											class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      {product.Status === 'MAJOR_INCREASE' ? 'bg-green-100 text-green-800' : ''}
                      {product.Status === 'INCREASE' ? 'bg-green-100 text-green-800' : ''}
                      {product.Status === 'MAJOR_DECREASE' ? 'bg-red-100 text-red-800' : ''}
                      {product.Status === 'DECREASE' ? 'bg-red-100 text-red-800' : ''}
                      {product.Status === 'NO_PREV_SALES' ? 'bg-indigo-100 text-indigo-800' : ''}
                      {product.Status === 'NEW_PRODUCT' ? 'bg-blue-100 text-blue-800' : ''}
                      {product.Status === 'DISCONTINUED' ? 'bg-gray-100 text-gray-800' : ''}
                      {product.Status === 'STABLE' ? 'bg-gray-100 text-gray-800' : ''}"
										>
											{product.Status === 'NO_PREV_SALES'
												? 'NO SALES PREV'
												: product.Status.replace('_', ' ')}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>
