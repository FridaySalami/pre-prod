<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import QRCode from 'qrcode';
	import {
		Users,
		Save,
		ArrowLeft,
		Loader2,
		Download,
		Trash2,
		QrCode,
		Printer
	} from 'lucide-svelte';

	let firstName = '';
	let lastName = '';
	let loading = false;
	let error: string | null = null;
	let success: string | null = null;
	let generatedQrCodeUrl: string | null = null;
	let generatedUser: { firstName: string; lastName: string } | null = null;

	let users: any[] = [];
	let usersLoading = true;

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
			}
		}
	}

	async function generateQrForUser(user: any) {
		const qrData = `DOLPHIN|${user.first_name}_${user.last_name}`;
		generatedQrCodeUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
		generatedUser = { firstName: user.first_name, lastName: user.last_name };

		// Scroll to bottom to see QR code
		setTimeout(() => {
			window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
		}, 100);
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
			// 1. Save to Supabase
			const { data, error: insertError } = await supabase
				.from('dolphin_users')
				.insert([{ first_name: firstName, last_name: lastName }])
				.select()
				.single();

			if (insertError) {
				if (insertError.code === '23505') {
					// Unique violation
					throw new Error('A user with this name already exists.');
				}
				throw insertError;
			}

			// 2. Generate QR Code
			const qrData = `DOLPHIN|${firstName}_${lastName}`;
			generatedQrCodeUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
			generatedUser = { firstName: data.first_name, lastName: data.last_name };

			success = 'User created successfully!';
			// Clear form
			firstName = '';
			lastName = '';

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
		window.print();
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl print:hidden">
	<div class="mb-6">
		<a
			href="/dashboard/dolphin-logs"
			class="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
		>
			<ArrowLeft class="h-4 w-4 mr-1" />
			Back to Logs
		</a>
		<div class="flex items-center gap-3">
			<div class="bg-blue-100 p-2 rounded-lg">
				<Users class="h-6 w-6 text-blue-600" />
			</div>
			<div>
				<h1 class="text-2xl font-bold text-gray-900">User Management</h1>
				<p class="text-sm text-gray-500">Create new login users for the Dolphin scanners</p>
			</div>
		</div>
	</div>

	<div class="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
		<div class="p-6 border-b border-gray-100">
			<h2 class="text-lg font-medium text-gray-900 mb-4">Create New User</h2>

			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="firstName" class="block text-sm font-medium text-gray-700 mb-1"
							>First Name <span class="text-red-500">*</span></label
						>
						<input
							id="firstName"
							type="text"
							bind:value={firstName}
							placeholder="e.g. Mark"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
							required
						/>
					</div>
					<div>
						<label for="lastName" class="block text-sm font-medium text-gray-700 mb-1"
							>Last Name <span class="text-red-500">*</span></label
						>
						<input
							id="lastName"
							type="text"
							bind:value={lastName}
							placeholder="e.g. Gill"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
							required
						/>
					</div>
				</div>

				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
						{error}
					</div>
				{/if}

				{#if success}
					<div
						class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm"
					>
						{success}
					</div>
				{/if}

				<div class="pt-2">
					<button
						type="submit"
						disabled={loading}
						class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{#if loading}
							<Loader2 class="h-4 w-4 mr-2 animate-spin" />
							Creating User...
						{:else}
							<Save class="h-4 w-4 mr-2" />
							Create User & Generate QR Code
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>

	<div class="mt-8 bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
		<div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
			<h2 class="text-lg font-medium text-gray-900">Existing Users</h2>
			<button on:click={fetchUsers} class="text-sm text-blue-600 hover:text-blue-800 font-medium">
				Refresh
			</button>
		</div>

		{#if usersLoading}
			<div class="p-8 text-center text-gray-500">
				<Loader2 class="h-8 w-8 mx-auto animate-spin mb-2" />
				Loading users...
			</div>
		{:else if users.length === 0}
			<div class="p-8 text-center text-gray-500">
				No users found. Create one above to get started.
			</div>
		{:else}
			<ul class="divide-y divide-gray-100">
				{#each users as user (user.id)}
					<li
						class="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
					>
						<div class="flex items-center">
							<div class="bg-gray-100 rounded-full h-10 w-10 flex items-center justify-center mr-4">
								<span class="text-gray-600 font-bold">
									{user.first_name[0]}{user.last_name[0]}
								</span>
							</div>
							<div>
								<p class="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</p>
								<p class="text-xs text-gray-500">
									Created: {new Date(user.created_at).toLocaleDateString()}
								</p>
							</div>
						</div>

						<div class="flex items-center space-x-2">
							<button
								on:click={() => generateQrForUser(user)}
								class="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
								title="Show QR Code"
							>
								<QrCode class="h-4 w-4" />
							</button>
							<button
								on:click={() => deleteUser(user.id)}
								class="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
								title="Delete User"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if generatedQrCodeUrl && generatedUser}
		<div
			class="mt-8 bg-white shadow rounded-lg border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden"
		>
			<div class="p-6 text-center">
				<h3 class="text-lg font-medium text-gray-900 mb-2">Login QR Code Generated</h3>
				<p class="text-sm text-gray-500 mb-6">
					Scan this code with the Dolphin scanner to log in as <span class="font-bold text-gray-900"
						>{generatedUser.firstName} {generatedUser.lastName}</span
					>
				</p>

				<div class="flex justify-center mb-6">
					<div class="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
						<img src={generatedQrCodeUrl} alt="Login QR Code" class="h-64 w-64" />
						<div class="mt-2 text-xs text-gray-400 font-mono">
							DOLPHIN|{generatedUser.firstName}_{generatedUser.lastName}
						</div>
					</div>
				</div>

				<button
					on:click={printQrCode}
					class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
				>
					<Printer class="h-4 w-4 mr-2" />
					Print QR Code
				</button>
			</div>
		</div>

		<!-- This part is only visible when printing -->
		<div class="printable-area hidden">
			<div class="text-center">
				<h1 class="text-3xl font-bold mb-4">Dolphin Scanner Login</h1>
				<img src={generatedQrCodeUrl} alt="Login QR Code" width="400" height="400" />
				<div class="qr-text">DOLPHIN|{generatedUser.firstName}_{generatedUser.lastName}</div>
				<div class="user-name">{generatedUser.firstName} {generatedUser.lastName}</div>
			</div>
		</div>
	{/if}
</div>

<style>
	@media print {
		/* Hide everything by default */
		:global(body > *) {
			display: none !important;
		}

		/* Show only the QR code printable area */
		.printable-area {
			display: flex !important;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: white;
		}

		/* Ensure the image and text are visible and styled correctly */
		.printable-area img {
			max-width: 400px;
			width: 100%;
			height: auto;
		}

		.printable-area .qr-text {
			font-family: monospace;
			font-size: 24px;
			margin-top: 20px;
			color: black;
			font-weight: bold;
		}

		.printable-area .user-name {
			font-family: sans-serif;
			font-size: 18px;
			margin-top: 10px;
			color: #333;
		}
	}
</style>
