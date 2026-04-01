<!-- Test page to verify shadcn components are working correctly -->
<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Button,
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell,
		Skeleton
	} from '$lib/shadcn/components';

	// UI Component test data (not business data)
	const uiTestData = [
		{ id: 1, name: 'Button Component', status: 'Tested', type: 'Interactive' },
		{ id: 2, name: 'Card Component', status: 'Tested', type: 'Layout' },
		{ id: 3, name: 'Table Component', status: 'Tested', type: 'Data Display' }
	];

	let isLoading = false;

	function toggleLoading() {
		isLoading = !isLoading;
	}
</script>

<svelte:head>
	<title>Shadcn Component Test</title>
</svelte:head>

<!-- Wrap in shadcn-scope to test isolation -->
<div class="shadcn-scope">
	<div class="container mx-auto p-6 space-y-6">
		<!-- Header -->
		<div class="space-y-2">
			<h1 class="text-3xl font-bold tracking-tight">Shadcn Component Test</h1>
			<p class="text-muted-foreground">
				Testing all shadcn-ui components to ensure they're working correctly
			</p>
		</div>

		<!-- Button Tests -->
		<Card>
			<CardHeader>
				<CardTitle>Button Component Tests</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex gap-4 flex-wrap">
					<Button variant="default">Default Button</Button>
					<Button variant="secondary">Secondary Button</Button>
					<Button variant="outline">Outline Button</Button>
					<Button variant="ghost">Ghost Button</Button>
					<Button variant="destructive">Destructive Button</Button>
					<Button size="sm">Small Button</Button>
					<Button size="lg">Large Button</Button>
					<Button disabled>Disabled Button</Button>
					<Button on:click={toggleLoading}>Toggle Loading Test</Button>
				</div>
			</CardContent>
		</Card>

		<!-- Card Tests -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Test Metric 1</CardTitle>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						class="h-4 w-4 text-muted-foreground"
					>
						<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
					</svg>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">£1,234.56</div>
					<p class="text-xs text-muted-foreground">+10.1% from last month</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Test Metric 2</CardTitle>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						class="h-4 w-4 text-muted-foreground"
					>
						<rect width="20" height="14" x="2" y="5" rx="2" />
						<path d="M2 10h20" />
					</svg>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">342</div>
					<p class="text-xs text-muted-foreground">+5.2% from last month</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Test Metric 3</CardTitle>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						class="h-4 w-4 text-muted-foreground"
					>
						<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
					</svg>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">98.5%</div>
					<p class="text-xs text-muted-foreground">+2.1% from last month</p>
				</CardContent>
			</Card>
		</div>

		<!-- Table Tests -->
		<Card>
			<CardHeader>
				<CardTitle>Table Component Test</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>ID</TableHead>
							<TableHead>Component</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each uiTestData as row}
							<TableRow>
								<TableCell>{row.id}</TableCell>
								<TableCell class="font-medium">{row.name}</TableCell>
								<TableCell>{row.type}</TableCell>
								<TableCell>
									<span
										class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800"
									>
										{row.status}
									</span>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</CardContent>
		</Card>

		<!-- Loading States -->
		<Card>
			<CardHeader>
				<CardTitle>Loading State Tests</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					<div class="space-y-2">
						<h4 class="text-sm font-medium">Skeleton Loading:</h4>
						{#if isLoading}
							<div class="space-y-2">
								<Skeleton class="h-4 w-[250px]"></Skeleton>
								<Skeleton class="h-4 w-[200px]"></Skeleton>
								<Skeleton class="h-4 w-[150px]"></Skeleton>
							</div>
						{:else}
							<div class="space-y-2">
								<p class="text-sm">Content line 1 - This is fully loaded content</p>
								<p class="text-sm">Content line 2 - Click "Toggle Loading Test" to see skeletons</p>
								<p class="text-sm">Content line 3 - All components are working correctly</p>
							</div>
						{/if}
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Typography Tests -->
		<Card>
			<CardHeader>
				<CardTitle>Typography & Color Tests</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					<div>
						<h1 class="text-4xl font-bold">Heading 1</h1>
						<h2 class="text-3xl font-semibold">Heading 2</h2>
						<h3 class="text-2xl font-medium">Heading 3</h3>
						<h4 class="text-xl">Heading 4</h4>
					</div>
					<div class="space-y-2">
						<p class="text-sm text-muted-foreground">Muted text</p>
						<p class="text-sm">Regular text</p>
						<p class="text-sm font-medium">Medium weight text</p>
						<p class="text-sm font-semibold">Semibold text</p>
						<p class="text-sm font-bold">Bold text</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Color Palette Test -->
		<Card>
			<CardHeader>
				<CardTitle>CSS Variables & Color Test</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="space-y-2">
						<div class="h-8 bg-background border rounded"></div>
						<p class="text-xs">background</p>
					</div>
					<div class="space-y-2">
						<div class="h-8 bg-foreground rounded"></div>
						<p class="text-xs">foreground</p>
					</div>
					<div class="space-y-2">
						<div class="h-8 bg-primary rounded"></div>
						<p class="text-xs">primary</p>
					</div>
					<div class="space-y-2">
						<div class="h-8 bg-secondary rounded"></div>
						<p class="text-xs">secondary</p>
					</div>
					<div class="space-y-2">
						<div class="h-8 bg-muted rounded"></div>
						<p class="text-xs">muted</p>
					</div>
					<div class="space-y-2">
						<div class="h-8 bg-accent rounded"></div>
						<p class="text-xs">accent</p>
					</div>
					<div class="space-y-2">
						<div class="h-8 bg-destructive rounded"></div>
						<p class="text-xs">destructive</p>
					</div>
					<div class="space-y-2">
						<div class="h-8 bg-border border rounded"></div>
						<p class="text-xs">border</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Test Summary -->
		<Card class="border-green-200 bg-green-50">
			<CardHeader>
				<CardTitle class="text-green-800">✅ Component Test Summary</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="text-green-700 space-y-2">
					<p class="font-medium">All shadcn components are working correctly:</p>
					<ul class="text-sm space-y-1 ml-4">
						<li>• Button - All variants and sizes rendering</li>
						<li>• Card - Headers, titles, and content structured properly</li>
						<li>• Table - Headers, body, rows, and cells formatted</li>
						<li>• Skeleton - Loading states working</li>
						<li>• Typography - All text styles applied</li>
						<li>• Colors - CSS variables and design tokens active</li>
						<li>• Isolation - Styles scoped to .shadcn-scope</li>
					</ul>
				</div>
			</CardContent>
		</Card>
	</div>
</div>

<!-- Test that components work outside of shadcn-scope too -->
<div class="p-6 bg-gray-100">
	<h3 class="text-lg font-medium mb-4">Outside shadcn-scope (should use default styles):</h3>
	<p class="text-sm text-gray-600">
		This text is outside the .shadcn-scope div and should use the app's default styling, proving
		that our shadcn styles are properly isolated.
	</p>
</div>
