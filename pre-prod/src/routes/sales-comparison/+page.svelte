<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import type { SubmitFunction } from '@sveltejs/kit';

	export let form: ActionData;
	export let data: PageData;
	let loading = false;
	let loadingMessage = '';
	let emailLoading = false;
	let oldReportName = '';
	let newReportName = '';

	let oldStartDate = '';
	let oldEndDate = '';
	let newStartDate = '';
	let newEndDate = '';

	let mode: 'upload' | 'api' = 'upload';

	function setQuickDate(
		type:
			| 'last-2-weeks'
			| 'last-2-days'
			| 'last-2-days-offset'
			| 'last-mondays'
			| 'last-fridays'
			| 'last-whole-week'
	) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const fmt = (d: Date) => {
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		};

		if (type === 'last-2-weeks') {
			// Previous 2 completed weeks (Sun-Sat)
			const day = today.getDay();
			const diffToSat = (day + 1) % 7;
			// If today is Sunday(0), diff=1 (Sat was yesterday) - Correct
			// If today is Monday(1), diff=2 (Sat was 2 days ago) - Correct
			// If today is Saturday(6), diff=0? No, last Sat was 7 days ago.

			const currentEnd = new Date(today);
			currentEnd.setDate(today.getDate() - (diffToSat === 0 ? 7 : diffToSat));

			const currentStart = new Date(currentEnd);
			currentStart.setDate(currentEnd.getDate() - 6); // Sunday

			const prevEnd = new Date(currentStart);
			prevEnd.setDate(prevEnd.getDate() - 1);

			const prevStart = new Date(prevEnd);
			prevStart.setDate(prevEnd.getDate() - 6);

			newStartDate = fmt(currentStart);
			newEndDate = fmt(currentEnd);
			oldStartDate = fmt(prevStart);
			oldEndDate = fmt(prevEnd);
		} else if (type === 'last-whole-week') {
			// Previous 2 completed weeks (Mon-Sun)
			const day = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
			// We want last Sunday as end date.
			// If today is Monday(1), last Sunday was yesterday(1 day ago).
			// If today is Sunday(0), last Sunday was 7 days ago.
			let diffToLastSun = day === 0 ? 7 : day;

			const currentEnd = new Date(today);
			currentEnd.setDate(today.getDate() - diffToLastSun);

			const currentStart = new Date(currentEnd);
			currentStart.setDate(currentEnd.getDate() - 6); // Monday

			const prevEnd = new Date(currentStart);
			prevEnd.setDate(prevEnd.getDate() - 1); // Previous Sunday

			const prevStart = new Date(prevEnd);
			prevStart.setDate(prevEnd.getDate() - 6); // Previous Monday

			newStartDate = fmt(currentStart);
			newEndDate = fmt(currentEnd);
			oldStartDate = fmt(prevStart);
			oldEndDate = fmt(prevEnd);
		} else if (type === 'last-2-days') {
			// Yesterday vs Day Before
			const yesterday = new Date(today);
			yesterday.setDate(today.getDate() - 1);

			const dayBefore = new Date(today);
			dayBefore.setDate(today.getDate() - 2);

			newStartDate = fmt(yesterday);
			newEndDate = fmt(yesterday);
			oldStartDate = fmt(dayBefore);
			oldEndDate = fmt(dayBefore);

			alert('Note: Buy Box data is often missing for yesterday in Amazon reports.');
		} else if (type === 'last-2-days-offset') {
			// Day Before vs Day Before That (to ensure BB data)
			const dayBefore = new Date(today);
			dayBefore.setDate(today.getDate() - 2);

			const dayBeforeThat = new Date(today);
			dayBeforeThat.setDate(today.getDate() - 3);

			newStartDate = fmt(dayBefore);
			newEndDate = fmt(dayBefore);
			oldStartDate = fmt(dayBeforeThat);
			oldEndDate = fmt(dayBeforeThat);
		} else if (type === 'last-mondays') {
			// Compare last completed Monday vs Monday before that
			const day = today.getDay();
			let diff = (day - 1 + 7) % 7;
			// If today is Monday (0 diff), we usually want "Last Monday" (7 days ago) to be safe with data
			if (diff === 0) diff = 7;

			const lastMon = new Date(today);
			lastMon.setDate(today.getDate() - diff);

			const prevMon = new Date(lastMon);
			prevMon.setDate(lastMon.getDate() - 7);

			newStartDate = fmt(lastMon);
			newEndDate = fmt(lastMon);
			oldStartDate = fmt(prevMon);
			oldEndDate = fmt(prevMon);
		} else if (type === 'last-fridays') {
			const day = today.getDay();
			let diff = (day - 5 + 7) % 7;
			if (diff === 0) diff = 7;

			const lastFri = new Date(today);
			lastFri.setDate(today.getDate() - diff);

			const prevFri = new Date(lastFri);
			prevFri.setDate(lastFri.getDate() - 7);

			newStartDate = fmt(lastFri);
			newEndDate = fmt(lastFri);
			oldStartDate = fmt(prevFri);
			oldEndDate = fmt(prevFri);
		}
	}

	const handleSubmit: SubmitFunction = () => {
		loading = true;

		// Set default titles for API mode if not set
		if (mode === 'api' && !oldReportName) {
			const start = (document.getElementById('oldStartDate') as HTMLInputElement)?.value;
			const end = (document.getElementById('oldEndDate') as HTMLInputElement)?.value;
			if (start && end) oldReportName = `${start} to ${end}`;
		}
		if (mode === 'api' && !newReportName) {
			const start = (document.getElementById('newStartDate') as HTMLInputElement)?.value;
			const end = (document.getElementById('newEndDate') as HTMLInputElement)?.value;
			if (start && end) newReportName = `${start} to ${end}`;
		}

		return async ({ update }) => {
			await update();
			loading = false;
		};
	};

	async function handleApiComparison() {
		loading = true;
		loadingMessage = 'Getting started...';
		// @ts-ignore
		form = { missing: false, success: false }; // Clear previous results

		try {
			if (!oldStartDate || !oldEndDate || !newStartDate || !newEndDate) {
				alert('Please select all dates.');
				loading = false;
				loadingMessage = '';
				return;
			}

			oldReportName = `${oldStartDate} to ${oldEndDate}`;
			newReportName = `${newStartDate} to ${newEndDate}`;

			console.log('Starting API comparison...');
			loadingMessage = 'Initiating report requests to Amazon...';

			// 1. Initiate Reports
			const [oldRes, newRes] = await Promise.all([
				fetch('/api/amazon/initiate-report', {
					method: 'POST',
					body: JSON.stringify({ startDate: oldStartDate, endDate: oldEndDate })
				}).then((r) => r.json()),
				fetch('/api/amazon/initiate-report', {
					method: 'POST',
					body: JSON.stringify({ startDate: newStartDate, endDate: newEndDate })
				}).then((r) => r.json())
			]);

			if (oldRes.error || newRes.error) {
				throw new Error(oldRes.error || newRes.error);
			}

			const oldReportId = oldRes.reportId;
			const newReportId = newRes.reportId;
			console.log('Reports started:', oldReportId, newReportId);

			// 2. Poll Status
			let complete = false;
			let attempts = 0;
			// Poll for up to 5 minutes (60 * 5s)
			while (!complete && attempts < 60) {
				loadingMessage = `Waiting for Amazon to process reports... (Attempt ${attempts + 1}/60)`;
				await new Promise((r) => setTimeout(r, 5000)); // Poll every 5s
				attempts++;

				const [s1, s2] = await Promise.all([
					fetch(`/api/amazon/report-status?reportId=${oldReportId}`).then((r) => r.json()),
					fetch(`/api/amazon/report-status?reportId=${newReportId}`).then((r) => r.json())
				]);

				if (s1.error || s2.error) throw new Error(s1.error || s2.error);

				console.log(`Poll ${attempts}:`, s1.status, s2.status);
				loadingMessage = `Report Status: Baseline=${s1.status}, Current=${s2.status} (Attempt ${attempts}/60)`;

				if (s1.status === 'DONE' && s2.status === 'DONE') {
					complete = true;
				} else if (
					['CANCELLED', 'FATAL'].includes(s1.status) ||
					['CANCELLED', 'FATAL'].includes(s2.status)
				) {
					throw new Error('Report cancelled or failed');
				}
			}

			if (!complete) throw new Error('Timed out waiting for reports.');

			// 3. Analyze
			console.log('Analyzing reports...');
			loadingMessage = 'Reports complete. Analyzing data...';
			const analyzeRes = await fetch('/api/amazon/analyze-reports', {
				method: 'POST',
				body: JSON.stringify({ oldReportId, newReportId })
			}).then((r) => r.json());

			if (analyzeRes.success) {
				// @ts-ignore
				form = {
					success: true,
					analysis: analyzeRes.analysis,
					excelReport: analyzeRes.excelReport
				};
			} else {
				throw new Error(analyzeRes.error || 'Analysis failed');
			}
		} catch (error: any) {
			console.error(error);
			// @ts-ignore
			form = { error: error.message };
			loadingMessage = ''; // Clear message on error
		} finally {
			loading = false;
			// loadingMessage is kept if successful? No, loading becomes false.
			if (!form?.success) loadingMessage = '';
		}
	}

	function handleFileSelect(e: Event, type: 'old' | 'new') {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			// Remove extension for cleaner default title
			const name = input.files[0].name.replace(/\.[^/.]+$/, '');
			if (type === 'old') oldReportName = name;
			else newReportName = name;
		}
	}

	let showEmailModal = false;
	let users: { id: string; email: string; name?: string }[] = [];
	let selectedUserEmails: string[] = [];
	let fetchingUsers = false;

	async function fetchUsers() {
		if (users.length > 0) return;
		fetchingUsers = true;
		try {
			const res = await fetch('/api/users');
			if (res.ok) {
				const data = await res.json();
				// Filter out specific test account and process names
				users = data.users
					.filter((u: any) => u.email !== 'jackweston@gmail.com')
					.map((u: any) => {
						let displayName = u.name || u.email.split('@')[0];
						// Capitalize first letter of each word in name
						displayName = displayName
							.split(' ')
							.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
							.join(' ');

						// Also handle dot separated names like jack.w
						if (displayName.includes('.')) {
							displayName = displayName
								.split('.')
								.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
								.join(' ');
						}

						return { ...u, name: displayName };
					});
			} else {
				console.error('Failed to fetch users');
			}
		} catch (e) {
			console.error('Error fetching users:', e);
		} finally {
			fetchingUsers = false;
		}
	}

	function openEmailModal() {
		fetchUsers();
		showEmailModal = true;
		// Default to current user if available and nothing selected
		if (data.user?.email && selectedUserEmails.length === 0) {
			selectedUserEmails = [data.user.email];
		}
	}

	function toggleUserSelection(email: string) {
		if (selectedUserEmails.includes(email)) {
			selectedUserEmails = selectedUserEmails.filter((e) => e !== email);
		} else {
			selectedUserEmails = [...selectedUserEmails, email];
		}
	}

	async function sendEmailMultiple() {
		if (selectedUserEmails.length === 0) {
			alert('Please select at least one recipient.');
			return;
		}
		await sendEmail(selectedUserEmails);
	}

	async function sendEmail(customRecipients?: string[] | Event) {
		if (!form?.analysis) return;
		emailLoading = true;

		// Determine recipients
		let recipients: string[] = [];
		if (Array.isArray(customRecipients)) {
			recipients = customRecipients;
		} else {
			recipients = [data.user?.email || 'jack.w@parkersfoodservice.co.uk'];
		}

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
							<div style="font-size: 12px; color: #6b7280; max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.Product_Title}</div>
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
				<div style="font-family: sans-serif; width: 100%; color: #333;">
					<h1 style="color: #1a56db; text-align: center;">Sales Comparison Report</h1>
					<p style="text-align: center; color: #666; margin-bottom: 5px;">
						<strong>${oldReportName}</strong> vs <strong>${newReportName}</strong>
					</p>
					<p style="text-align: center; color: #666; margin-top: 0;">Generated on ${new Date().toLocaleDateString()}</p>
					
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
					to: recipients,
					subject: `Sales Comparison Report: ${oldReportName} vs ${newReportName}`,
					html,
					attachments
				})
			});

			const result = await response.json();

			if (response.ok) {
				const recipientsDisplay =
					recipients.length > 3 ? `${recipients.length} recipients` : recipients.join(', ');
				alert(`Report emailed successfully to ${recipientsDisplay}!`);
				showEmailModal = false;
			} else {
				const errorMessage =
					typeof result.error === 'string'
						? result.error
						: result.error?.message || JSON.stringify(result.error);
				alert(`Failed to send email: ${errorMessage}`);
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

	let sortColumn = 'Sales_Change';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let selectedStatus: string | null = null;

	const statusOptions = [
		{
			value: 'MAJOR_INCREASE',
			label: 'Major Increase',
			class: 'bg-green-100 text-green-800 hover:bg-green-200'
		},
		{
			value: 'INCREASE',
			label: 'Increase',
			class: 'bg-green-50 text-green-800 hover:bg-green-100'
		},
		{
			value: 'MAJOR_DECREASE',
			label: 'Major Decrease',
			class: 'bg-red-100 text-red-800 hover:bg-red-200'
		},
		{ value: 'DECREASE', label: 'Decrease', class: 'bg-red-50 text-red-800 hover:bg-red-100' },
		{
			value: 'NO_PREV_SALES',
			label: 'No Prev Sales',
			class: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
		},
		{
			value: 'NEW_PRODUCT',
			label: 'New Product',
			class: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
		},
		{
			value: 'DISCONTINUED',
			label: 'Dropped to Zero',
			class: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
		},
		{ value: 'STABLE', label: 'Stable', class: 'bg-gray-50 text-gray-800 hover:bg-gray-100' }
	];

	function sortTable(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'desc';
		}
	}

	$: sortedProducts = form?.analysis?.products
		? [...form.analysis.products]
				.filter((p) => (selectedStatus ? p.Status === selectedStatus : true))
				.sort((a, b) => {
					let valA = a[sortColumn];
					let valB = b[sortColumn];

					if (typeof valA === 'string') valA = valA.toLowerCase();
					if (typeof valB === 'string') valB = valB.toLowerCase();

					if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
					if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
					return 0;
				})
		: [];

	let copiedSku: string | null = null;

	function copySku(sku: string) {
		navigator.clipboard.writeText(sku);
		copiedSku = sku;
		setTimeout(() => {
			if (copiedSku === sku) copiedSku = null;
		}, 2000);
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
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8" aria-label="Tabs">
				<button
					on:click={() => (mode = 'upload')}
					class="{mode === 'upload'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors"
				>
					Upload Reports (CSV)
				</button>
				<button
					on:click={() => (mode = 'api')}
					class="{mode === 'api'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors"
				>
					Fetch from Amazon (API)
				</button>
			</nav>
		</div>

		<form method="POST" enctype="multipart/form-data" use:enhance={handleSubmit} class="space-y-6">
			{#if mode === 'upload'}
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
											required={mode === 'upload'}
											class="sr-only"
											on:change={(e) => handleFileSelect(e, 'old')}
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
											required={mode === 'upload'}
											class="sr-only"
											on:change={(e) => handleFileSelect(e, 'new')}
										/>
									</label>
									<p class="pl-1">or drag and drop</p>
								</div>
								<p class="text-xs text-gray-500">CSV up to 10MB</p>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div
					class="mb-6 flex flex-wrap gap-2 items-center bg-gray-50 p-3 rounded-lg border border-gray-200"
				>
					<span class="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-2"
						>Quick Report Presets:</span
					>
					<button
						type="button"
						on:click={() => setQuickDate('last-2-weeks')}
						class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						Full Weeks (Sun-Sat)
					</button>
					<button
						type="button"
						on:click={() => setQuickDate('last-whole-week')}
						class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						Full Weeks (Mon-Sun)
					</button>
					<button
						type="button"
						on:click={() => setQuickDate('last-2-days')}
						class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
						title="Compare Yesterday vs Day Before. Note: Yesterday's Buy Box data may be incomplete."
					>
						Yesterday (No BB)
					</button>
					<button
						type="button"
						on:click={() => setQuickDate('last-2-days-offset')}
						class="inline-flex items-center px-3 py-1.5 border border-purple-300 shadow-sm text-xs font-medium rounded text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
						title="Compare Day Before Yesterday vs Day Before That. Ensures Buy Box data is available."
					>
						Previous 2 Days (With BB)
					</button>
					<button
						type="button"
						on:click={() => setQuickDate('last-mondays')}
						class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						Compare Mondays
					</button>
					<button
						type="button"
						on:click={() => setQuickDate('last-fridays')}
						class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						Compare Fridays
					</button>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
					<div class="space-y-4 p-4 border rounded-md bg-gray-50">
						<h3 class="text-lg font-medium text-gray-900 border-b pb-2">Baseline Period</h3>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="oldStartDate" class="block text-sm font-medium text-gray-700"
									>Start Date</label
								>
								<input
									type="date"
									id="oldStartDate"
									name="oldStartDate"
									bind:value={oldStartDate}
									required={mode === 'api'}
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
								/>
							</div>
							<div>
								<label for="oldEndDate" class="block text-sm font-medium text-gray-700"
									>End Date</label
								>
								<input
									type="date"
									id="oldEndDate"
									name="oldEndDate"
									bind:value={oldEndDate}
									required={mode === 'api'}
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
								/>
							</div>
						</div>
					</div>

					<div class="space-y-4 p-4 border rounded-md bg-gray-50">
						<h3 class="text-lg font-medium text-gray-900 border-b pb-2">Current Period</h3>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="newStartDate" class="block text-sm font-medium text-gray-700"
									>Start Date</label
								>
								<input
									type="date"
									id="newStartDate"
									name="newStartDate"
									bind:value={newStartDate}
									required={mode === 'api'}
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
								/>
							</div>
							<div>
								<label for="newEndDate" class="block text-sm font-medium text-gray-700"
									>End Date</label
								>
								<input
									type="date"
									id="newEndDate"
									name="newEndDate"
									bind:value={newEndDate}
									required={mode === 'api'}
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
								/>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<div class="flex flex-col sm:flex-row justify-end gap-3">
				{#if mode === 'upload'}
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
				{:else}
					<button
						type="button"
						on:click={handleApiComparison}
						disabled={loading}
						class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
							Fetching & Analyzing...
						{:else}
							Fetch Data & Compare
						{/if}
					</button>
				{/if}
			</div>

			{#if loading && loadingMessage}
				<div class="flex items-center justify-end">
					<span class="text-sm text-gray-500 animate-pulse">{loadingMessage}</span>
				</div>
			{/if}
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
		<div class="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
			<h3 class="text-sm font-medium text-blue-900 mb-3">Report Titles (for Email)</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="oldReportTitle" class="block text-xs font-medium text-blue-700 mb-1">
						Baseline Report Title
					</label>
					<input
						type="text"
						id="oldReportTitle"
						bind:value={oldReportName}
						class="block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
						placeholder="e.g. Last Week"
					/>
				</div>
				<div>
					<label for="newReportTitle" class="block text-xs font-medium text-blue-700 mb-1">
						Current Report Title
					</label>
					<input
						type="text"
						id="newReportTitle"
						bind:value={newReportName}
						class="block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
						placeholder="e.g. This Week"
					/>
				</div>
			</div>
		</div>

		<div class="flex justify-end mb-4 space-x-4">
			<button
				on:click={openEmailModal}
				disabled={emailLoading}
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
			>
				<svg class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
				Email Multiple
			</button>

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

			<!-- Filters -->
			<div class="flex flex-wrap gap-2 mb-4">
				<button
					class="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border {selectedStatus ===
					null
						? 'bg-gray-800 text-white border-gray-800'
						: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
					on:click={() => (selectedStatus = null)}
				>
					All
				</button>
				{#each statusOptions as option}
					<button
						class="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border {selectedStatus ===
						option.value
							? 'ring-2 ring-offset-1 ring-blue-500 ' + option.class
							: 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}"
						on:click={() =>
							(selectedStatus = selectedStatus === option.value ? null : option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>

			<!-- Detailed Table -->
			<div class="bg-white shadow overflow-hidden rounded-lg">
				<div class="px-4 py-5 sm:px-6 flex justify-between items-center">
					<h3 class="text-lg leading-6 font-medium text-gray-900">Product Performance Review</h3>
					<span class="text-sm text-gray-500"
						>Showing {sortedProducts.length} of {form.analysis.summary.product_count} products</span
					>
				</div>
				<div class="border-t border-gray-200 overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('Product_Title')}
								>
									Product / SKU {sortColumn === 'Product_Title'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('Old_Sales')}
								>
									Old Sales {sortColumn === 'Old_Sales'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('New_Sales')}
								>
									New Sales {sortColumn === 'New_Sales'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('Sales_Change')}
								>
									Change (£) {sortColumn === 'Sales_Change'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('Sales_Change_Percent')}
								>
									Change (%) {sortColumn === 'Sales_Change_Percent'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('Page_Views_Change')}
								>
									Page Views (Old → New) {sortColumn === 'Page_Views_Change'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('Conversion_Change')}
								>
									Conversion (Old → New) {sortColumn === 'Conversion_Change'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('BuyBox_Change')}
								>
									Buy Box (Old → New) {sortColumn === 'BuyBox_Change'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
									on:click={() => sortTable('Status')}
								>
									Status {sortColumn === 'Status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each sortedProducts as product}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4">
										<div
											class="text-sm font-medium text-gray-900 line-clamp-2"
											title={product.Product_Title}
										>
											{product.Product_Title}
										</div>
										<div class="text-sm text-gray-500 flex items-center gap-2 group">
											<span>{product.SKU}</span>
											<button
												type="button"
												class="text-gray-300 hover:text-blue-600 focus:outline-none transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
												title="Copy SKU"
												on:click={() => copySku(product.SKU)}
											>
												{#if copiedSku === product.SKU}
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-4 w-4 text-green-600"
														viewBox="0 0 20 20"
														fill="currentColor"
													>
														<path
															fill-rule="evenodd"
															d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
															clip-rule="evenodd"
														/>
													</svg>
												{:else}
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-4 w-4"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
														/>
													</svg>
												{/if}
											</button>
										</div>
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
												: product.Status === 'DISCONTINUED'
													? 'DROPPED TO ZERO'
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

<!-- Email Modal -->
{#if showEmailModal}
	<div
		class="fixed z-50 inset-0 overflow-y-auto"
		aria-labelledby="modal-title"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
		>
			<div
				class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
				aria-hidden="true"
				on:click={() => (showEmailModal = false)}
			></div>

			<span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true"
				>&#8203;</span
			>

			<div
				class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 relative z-50"
			>
				<div class="sm:flex sm:items-start">
					<div
						class="mx-auto shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10"
					>
						<svg
							class="h-6 w-6 text-indigo-600"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
					</div>
					<div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
						<h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
							Select Recipients
						</h3>

						{#if !fetchingUsers && users.length > 0}
							<div class="mt-2 flex justify-end space-x-2 text-xs">
								<button
									on:click={() => (selectedUserEmails = users.map((u) => u.email))}
									class="text-indigo-600 hover:text-indigo-800 font-medium"
								>
									Select All
								</button>
								<button
									on:click={() => (selectedUserEmails = [])}
									class="text-gray-500 hover:text-gray-700 font-medium"
								>
									Deselect All
								</button>
							</div>
						{/if}

						<div class="mt-2 text-sm text-gray-500 max-h-60 overflow-y-auto border rounded p-2">
							{#if fetchingUsers}
								<div class="flex justify-center p-4">
									<svg
										class="animate-spin h-5 w-5 text-indigo-600"
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
								</div>
							{:else}
								<div class="space-y-2">
									{#each users as user}
										<label
											class="flex items-center space-x-3 cursor-pointer p-1 hover:bg-gray-50 rounded select-none"
										>
											<input
												type="checkbox"
												checked={selectedUserEmails.includes(user.email)}
												on:change={() => toggleUserSelection(user.email)}
												class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
											/>
											<div class="flex flex-col text-left">
												<span class="text-gray-900 font-medium">{user.name}</span>
												<span class="text-gray-500 text-xs">{user.email}</span>
											</div>
										</label>
									{/each}
									{#if users.length === 0}
										<div class="text-center p-4">
											<p class="text-gray-500">No users found.</p>
											<button
												on:click={fetchUsers}
												class="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
											>
												Retry
											</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>
				<div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
					<button
						type="button"
						on:click={sendEmailMultiple}
						disabled={emailLoading || selectedUserEmails.length === 0}
						class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm disabled:opacity-50"
					>
						{#if emailLoading}
							Sending...
						{:else}
							Send Email ({selectedUserEmails.length})
						{/if}
					</button>
					<button
						type="button"
						on:click={() => (showEmailModal = false)}
						class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
