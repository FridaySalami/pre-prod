<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import QRCode from 'qrcode';
	import {
		Users,
		ArrowLeft,
		Loader2,
		Trash2,
		QrCode,
		Printer,
		Search,
		Plus,
		UserCheck,
		UserPlus,
		RefreshCw
	} from 'lucide-svelte';
	import * as Dialog from '$lib/shadcn/ui/dialog';
	import { Button } from '$lib/shadcn/ui/button';
	import { fade, slide } from 'svelte/transition';

	let firstName = '';
	let lastName = '';
	let loading = false;
	let error: string | null = null;
	let success: string | null = null;
	let generatedQrCodeUrl: string | null = null;
	let generatedUser: { firstName: string; lastName: string } | null = null;
	let isQrModalOpen = false;

	let users: any[] = [];
	let usersLoading = true;
	let searchTerm = '';

	$: filteredUsers = users.filter((u) => {
		const fullSearch = `${u.first_name} ${u.last_name} ${u.login_code}`.toLowerCase();
		return fullSearch.includes(searchTerm.toLowerCase());
	});

	$: stats = {
		total: users.length,
		newThisMonth: users.filter((u) => {
			const created = new Date(u.created_at);
			const now = new Date();
			return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
		}).length
	};

	onMount(() => {
		fetchUsers();
	});

	async function fetchUsers() {
		usersLoading = true;
		const { data, error } = await supabase
			.from('dolphin_users')
			.select('*')
			.order('created_at', { ascending: false });

		if (data) {
			users = data;
		}
		usersLoading = false;
	}

	async function deleteUser(id: string) {
		if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

		const { error } = await supabase.from('dolphin_users').delete().eq('id', id);

		if (error) {
			console.error('Error deleting user:', error);
			alert('Failed to delete user');
		} else {
			fetchUsers();
			// Clear QR code if it was for this user
			if (generatedUser) {
				generatedUser = null;
				generatedQrCodeUrl = null;
				isQrModalOpen = false;
			}
		}
	}

	async function generateQrForUser(user: any) {
		const qrData = user.login_code || `DOLPHIN|${user.first_name}_${user.last_name}`;
		generatedQrCodeUrl = await QRCode.toDataURL(qrData, {
			width: 600,
			margin: 2,
			color: {
				dark: '#000000',
				light: '#ffffff'
			}
		});
		generatedUser = { firstName: user.first_name, lastName: user.last_name };
		isQrModalOpen = true;
	}

	async function handleSubmit() {
		loading = true;
		error = null;
		success = null;
		generatedQrCodeUrl = null;
		generatedUser = null;

		if (!firstName || !lastName) {
			error = 'First name and last name are required.';
			loading = false;
			return;
		}

		try {
			const loginCode = `DOLPHIN|${firstName}_${lastName}`;

			// 1. Save to Supabase
			const { data, error: insertError } = await supabase
				.from('dolphin_users')
				.insert([
					{
						first_name: firstName.trim(),
						last_name: lastName.trim(),
						login_code: loginCode
					}
				])
				.select()
				.single();

			if (insertError) {
				if (insertError.code === '23505') {
					throw new Error('A user with this name already exists.');
				}
				throw insertError;
			}

			// 2. Generate QR Code
			generatedQrCodeUrl = await QRCode.toDataURL(loginCode, { width: 600, margin: 2 });
			generatedUser = { firstName: data.first_name, lastName: data.last_name };

			success = 'User created successfully!';
			// Clear form
			firstName = '';
			lastName = '';
			isQrModalOpen = true;

			// Refresh list
			fetchUsers();
		} catch (err: any) {
			console.error('Error creating user:', err);
			error = err.message || 'An unexpected error occurred.';
		} finally {
			loading = false;
		}
	}

	function printQrCode() {
		const printWindow = window.open('', '_blank');
		if (printWindow && generatedQrCodeUrl && generatedUser) {
			printWindow.document.write(`
				<html>
					<head>
						<title>Operator Badge - ${generatedUser.firstName} ${generatedUser.lastName}</title>
						<style>
							@page { size: auto; margin: 0; }
							body { 
								font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
								display: flex; 
								flex-direction: column; 
								align-items: center; 
								justify-content: center; 
								height: 100vh; 
								margin: 0; 
								background: white;
								color: black;
							}
							.badge {
								border: 2px solid #e2e8f0;
								padding: 40px;
								border-radius: 24px;
								text-align: center;
								box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
								width: 350px;
							}
							.logo {
								font-size: 14px;
								font-weight: 900;
								color: #2563eb;
								letter-spacing: 0.1em;
								margin-bottom: 20px;
								text-transform: uppercase;
							}
							img { width: 250px; height: 250px; margin: 20px 0; }
							.name { font-size: 28px; font-weight: 800; margin-bottom: 8px; color: #111827; }
							.code { font-family: monospace; font-size: 14px; color: #6b7280; font-weight: 600; padding: 6px 12px; background: #f3f4f6; border-radius: 8px; display: inline-block; }
						</style>
					</head>
					<body>
						<div class="badge">
							<div class="logo">Dolphin Scan to Pack</div>
							<div class="name">${generatedUser.firstName} ${generatedUser.lastName}</div>
							<img src="${generatedQrCodeUrl}" />
							<div>
								<span class="code">DOLPHIN|${generatedUser.firstName}_${generatedUser.lastName}</span>
							</div>
						</div>
						<script>
							window.onload = () => {
								setTimeout(() => {
									window.print();
									setTimeout(() => window.close(), 500);
								}, 500);
							};
						<\/script>
					</body>
				</html>
			`);
			printWindow.document.close();
		}
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
	<div class="mb-8">
		<a
			href="/dashboard/dolphin-logs"
			class="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors group mb-4"
		>
			<ArrowLeft class="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
			Back to System Logs
		</a>
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="bg-blue-600 p-2.5 rounded-xl shadow-blue-200 shadow-lg">
					<Users class="h-7 w-7 text-white" />
				</div>
				<div>
					<h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Scanner Users</h1>
					<p class="text-base text-gray-500">Manage operator profiles and login credentials</p>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<div
					class="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3"
				>
					<div class="p-1.5 bg-green-50 rounded-md">
						<UserCheck class="h-4 w-4 text-green-600" />
					</div>
					<div>
						<p class="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Users</p>
						<p class="text-lg font-bold text-gray-900 leading-none">{stats.total}</p>
					</div>
				</div>
				<div
					class="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3"
				>
					<div class="p-1.5 bg-blue-50 rounded-md">
						<UserPlus class="h-4 w-4 text-blue-600" />
					</div>
					<div>
						<p class="text-[10px] uppercase tracking-wider font-bold text-gray-400">New (Month)</p>
						<p class="text-lg font-bold text-gray-900 leading-none">{stats.newThisMonth}</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
		<!-- Left: Create User Panel -->
		<div class="lg:col-span-4 transition-all duration-300">
			<div
				class="bg-white shadow-xl shadow-gray-100 rounded-2xl border border-gray-200 overflow-hidden sticky top-8"
			>
				<div class="p-6 bg-gray-50/50 border-b border-gray-100">
					<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
						<Plus class="h-5 w-5 text-blue-600" />
						Create New Operator
					</h2>
				</div>

				<div class="p-6">
					<form on:submit|preventDefault={handleSubmit} class="space-y-5">
						<div class="space-y-1">
							<label for="firstName" class="block text-sm font-semibold text-gray-700"
								>First Name</label
							>
							<input
								id="firstName"
								type="text"
								bind:value={firstName}
								placeholder="e.g. Mark"
								class="w-full rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5 px-3 border transition-all"
								required
							/>
						</div>
						<div class="space-y-1">
							<label for="lastName" class="block text-sm font-semibold text-gray-700"
								>Last Name</label
							>
							<input
								id="lastName"
								type="text"
								bind:value={lastName}
								placeholder="e.g. Gill"
								class="w-full rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5 px-3 border transition-all"
								required
							/>
						</div>

						{#if error}
							<div
								class="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in zoom-in duration-200"
								transition:slide
							>
								{error}
							</div>
						{/if}

						{#if success}
							<div
								class="bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in zoom-in duration-200"
								transition:slide
							>
								{success}
							</div>
						{/if}

						<button
							type="submit"
							disabled={loading}
							class="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
						>
							{#if loading}
								<Loader2 class="h-4 w-4 mr-2 animate-spin" />
								Processing...
							{:else}
								<Plus class="h-4 w-4 mr-2" />
								Add New Operator
							{/if}
						</button>
					</form>
				</div>
			</div>
		</div>

		<!-- Right: Existing Users List -->
		<div class="lg:col-span-8 space-y-4">
			<div
				class="bg-white shadow-xl shadow-gray-100 rounded-2xl border border-gray-200 overflow-hidden"
			>
				<div
					class="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
				>
					<div class="relative w-full sm:w-80">
						<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<Search class="h-4 w-4 text-gray-400" />
						</div>
						<input
							type="text"
							bind:value={searchTerm}
							placeholder="Filter by name or code..."
							class="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50/50"
						/>
					</div>

					<div class="flex items-center gap-3">
						<button
							on:click={fetchUsers}
							class="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 font-semibold transition-colors disabled:opacity-50"
							disabled={usersLoading}
						>
							<RefreshCw class={`h-4 w-4 mr-2 ${usersLoading ? 'animate-spin' : ''}`} />
							Sync Data
						</button>
					</div>
				</div>

				<div class="overflow-x-auto">
					{#if usersLoading}
						<div class="p-12 text-center text-gray-500">
							<Loader2 class="h-10 w-10 mx-auto animate-spin mb-4 text-blue-500" />
							<p class="font-medium">Retrieving operator profiles...</p>
						</div>
					{:else if filteredUsers.length === 0}
						<div class="p-12 text-center">
							<div
								class="bg-gray-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
							>
								<Users class="h-8 w-8 text-gray-400" />
							</div>
							<h3 class="text-base font-bold text-gray-900">No operators matching records</h3>
							<p class="text-sm text-gray-500 mt-1">
								Try adjusting your search terms or create a new user profile.
							</p>
						</div>
					{:else}
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th
										class="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest"
										>Operator</th
									>
									<th
										class="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden md:table-cell"
										>Login Code</th
									>
									<th
										class="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:table-cell"
										>Enrolled On</th
									>
									<th
										class="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest"
										>Actions</th
									>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each filteredUsers as user (user.id)}
									<tr class="hover:bg-blue-50/30 transition-colors group">
										<td class="px-6 py-4">
											<div class="flex items-center">
												<div
													class="bg-linear-to-br from-blue-100 to-indigo-100 rounded-xl h-10 w-10 flex items-center justify-center mr-3 shadow-inner ring-4 ring-white"
												>
													<span class="text-blue-700 font-extrabold text-sm uppercase">
														{user.first_name[0]}{user.last_name[0]}
													</span>
												</div>
												<div>
													<p class="text-sm font-bold text-gray-900 leading-tight">
														{user.first_name}
														{user.last_name}
													</p>
													<p class="text-[11px] text-gray-500 md:hidden mt-0.5 font-mono">
														{user.login_code.split('|')[1]}
													</p>
												</div>
											</div>
										</td>
										<td class="px-6 py-4 hidden md:table-cell">
											<code
												class="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[11px] font-mono border border-gray-200"
											>
												{user.login_code}
											</code>
										</td>
										<td class="px-6 py-4 hidden sm:table-cell">
											<span class="text-xs text-gray-500 font-medium whitespace-nowrap">
												{new Date(user.created_at).toLocaleDateString(undefined, {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})}
											</span>
										</td>
										<td class="px-6 py-4 text-right">
											<div class="flex items-center justify-end gap-1">
												<button
													on:click={() => generateQrForUser(user)}
													class="p-2 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
													title="Generate QR Credentials"
												>
													<QrCode class="h-4 w-4" />
												</button>
												<button
													on:click={() => deleteUser(user.id)}
													class="p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
													title="Revoke Access"
												>
													<Trash2 class="h-4 w-4" />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
				<div
					class="p-4 bg-gray-50 border-t border-gray-100 text-[11px] text-center text-gray-400 italic font-medium"
				>
					Access is unique to first/last name combinations. Revoked users cannot be restored.
				</div>
			</div>
		</div>
	</div>
</div>

<!-- QR Code Modal Dialog -->
<Dialog.Root bind:open={isQrModalOpen}>
	<Dialog.Content
		class="p-0! border-none shadow-2xl bg-white overflow-hidden w-[95vw] max-w-[850px]! sm:max-w-[850px]! gap-0!"
	>
		{#if generatedUser && generatedQrCodeUrl}
			<div class="flex flex-col md:flex-row md:items-stretch h-full">
				<!-- Left Branding/Info Side -->
				<div
					class="w-full md:w-[40%] bg-linear-to-br from-blue-700 to-indigo-800 p-8 md:p-10 text-white flex flex-col justify-between relative overflow-hidden shrink-0"
				>
					<div class="relative z-10">
						<div
							class="bg-white/10 p-2 rounded-xl mb-4 w-fit ring-1 ring-white/20 backdrop-blur-md"
						>
							<UserCheck class="h-6 w-6 text-blue-100" />
						</div>
						<Dialog.Title class="text-2xl font-black text-white leading-tight mb-2">
							Operator Badge
						</Dialog.Title>
						<p class="text-blue-100/60 text-xs font-medium tracking-wide">
							Ready for immediate scanning.
						</p>
					</div>

					<div class="relative z-10 mt-6 space-y-5">
						<div
							class="bg-white/10 rounded-xl p-4 border border-white/5 backdrop-blur-md shadow-inner"
						>
							<span
								class="text-[8px] font-black text-blue-200 uppercase tracking-widest block mb-1 opacity-70"
								>Current Operator</span
							>
							<div class="text-xl font-bold text-white leading-tight truncate">
								{generatedUser.firstName}
								{generatedUser.lastName}
							</div>
							<div class="mt-3 flex items-center gap-2">
								<span
									class="text-[8px] font-mono text-white/30 uppercase font-bold tracking-tighter"
									>UID:</span
								>
								<span class="text-[10px] font-mono font-bold text-blue-300 truncate"
									>DOLPHIN|{generatedUser.firstName}_{generatedUser.lastName}</span
								>
							</div>
						</div>

						<div class="flex flex-col gap-2 pt-2">
							<Button
								onclick={printQrCode}
								class="w-full bg-white text-blue-700 hover:bg-blue-50 font-black h-10 rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
							>
								<Printer class="h-4 w-4" />
								Print Badge
							</Button>
							<Button
								variant="ghost"
								onclick={() => (isQrModalOpen = false)}
								class="w-full text-white hover:text-white font-bold h-10 rounded-lg hover:bg-white/10 transition-all border border-white/10 text-sm"
							>
								Close Window
							</Button>
						</div>
					</div>

					<!-- Decorative QR -->
					<div class="absolute -bottom-10 -left-10 opacity-10 pointer-events-none">
						<QrCode class="w-48 h-48" />
					</div>
				</div>

				<!-- Right QR Code Side -->
				<div
					class="w-full md:w-[60%] p-8 md:p-10 bg-white flex flex-col items-center justify-center relative min-h-[380px]"
				>
					<div
						class="relative bg-white p-5 border-4 border-gray-50 rounded-[2.5rem] shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-blue-200/50 group"
					>
						<img
							src={generatedQrCodeUrl}
							alt="Login QR Code"
							class="h-48 w-48 rounded-xl pointer-events-none"
						/>
						<div class="mt-4 text-center">
							<span
								class="bg-blue-600 text-white px-5 py-1.5 rounded-full text-[12px] font-black shadow-lg tracking-[0.2em] whitespace-nowrap group-hover:bg-indigo-600 transition-colors"
							>
								SCAN CREDENTIALS
							</span>
						</div>
					</div>

					<div class="mt-8 text-center">
						<p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
							System Verification Status
						</p>
						<div
							class="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-100 rounded-full"
						>
							<div class="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
							<span class="text-[10px] font-black text-green-700 tracking-wider uppercase"
								>Active Credentials</span
							>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<style>
	/* styles removed as we now use window.open for printing */
</style>
