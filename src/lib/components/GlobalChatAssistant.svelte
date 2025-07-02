<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Card, CardHeader, CardTitle, CardContent, Button } from '$lib/shadcn/components';
	import { aiAssistantStore } from '$lib/stores/aiAssistantStore';
	import type { AIAssistantData } from '$lib/stores/aiAssistantStore';

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
		functionCalls?: Array<{
			name: string;
			result: any;
			error?: string;
		}>;
	}

	// State
	let messages: ChatMessage[] = $state([]);
	let currentMessage = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let chatContainer: HTMLElement | undefined = $state();
	let useAdvancedAI = $state(false); // Toggle between basic and advanced AI

	// Store subscription
	let assistantState = $state($aiAssistantStore);
	let unsubscribe: (() => void) | undefined;

	onMount(() => {
		unsubscribe = aiAssistantStore.subscribe((state) => {
			assistantState = state;
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	// Computed values
	const isVisible = $derived(assistantState.isVisible);
	const currentData = $derived(assistantState.currentData);
	const hasData = $derived(currentData !== null);

	// Predefined quick questions based on page type
	const getQuickQuestions = (pageType: string): string[] => {
		const basicQuestions = [
			"What are the key trends in this month's data?",
			'Which sales channel is performing best?',
			'Are there any concerning patterns I should know about?',
			'What recommendations do you have for improvement?'
		];

		const advancedQuestions = [
			'Calculate the growth rate for total sales this month',
			'Show me a breakdown of performance by channel',
			'Generate an overall performance summary',
			'Analyze the sales trend over the first and second half of the month',
			'Query the data for the first week only',
			'What insights do you have about labor efficiency?'
		];

		switch (pageType) {
			case 'monthly-analytics':
				return useAdvancedAI ? advancedQuestions : basicQuestions;
			case 'weekly-analytics':
				return [
					'How does this week compare to previous weeks?',
					'What weekly patterns do you notice?',
					'Are there any weekly seasonal trends?',
					'Which days of the week perform best?',
					'What weekly optimizations do you suggest?'
				];
			default:
				return [
					'What insights can you provide from this data?',
					'What trends do you notice?',
					'What should I focus on?',
					'Are there any red flags in the data?',
					'What opportunities do you see?'
				];
		}
	};

	/**
	 * Send message to ChatGPT API
	 */
	async function sendMessage(messageText?: string) {
		const textToSend = messageText || currentMessage.trim();

		if (!textToSend || isLoading || !currentData) return;

		// Add user message
		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: textToSend,
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		currentMessage = '';
		isLoading = true;
		error = null;

		try {
			// Choose API endpoint based on AI mode
			const apiEndpoint = useAdvancedAI ? '/api/assistant' : '/api/chat';

			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: textToSend,
					analyticsData: currentData.data
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to get response');
			}

			const data = await response.json();

			// Add assistant response
			const assistantMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: data.response,
				timestamp: new Date(),
				functionCalls: data.functionCalls // Include function calls if available
			};

			messages = [...messages, assistantMessage];

			// Scroll to bottom
			setTimeout(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}, 100);
		} catch (err) {
			console.error('Chat error:', err);
			error = err instanceof Error ? err.message : 'Failed to send message';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Clear chat history
	 */
	function clearChat() {
		messages = [];
		error = null;
	}

	/**
	 * Close the assistant
	 */
	function closeAssistant() {
		aiAssistantStore.hide();
	}

	/**
	 * Handle Enter key press
	 */
	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	/**
	 * Format timestamp
	 */
	function formatTime(date: Date): string {
		return date.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Get page type display name
	 */
	function getPageDisplayName(pageType: string): string {
		switch (pageType) {
			case 'monthly-analytics':
				return 'Monthly Analytics';
			case 'weekly-analytics':
				return 'Weekly Analytics';
			default:
				return 'Analytics Dashboard';
		}
	}
</script>

{#if isVisible}
	<!-- Chat Assistant Overlay -->
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div
			class="bg-background rounded-lg shadow-xl border max-w-4xl w-full max-h-[80vh] flex flex-col"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b">
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
					<div>
						<h2 class="text-lg font-semibold">
							{useAdvancedAI ? 'AI Assistant Pro' : 'AI Data Analysis Assistant'}
						</h2>
						{#if currentData}
							<p class="text-sm text-muted-foreground">
								Analyzing: {getPageDisplayName(currentData.pageType)}
								<span class="text-xs">
									(Updated: {currentData.lastUpdated.toLocaleTimeString()})
								</span>
							</p>
						{/if}
					</div>
				</div>
				<div class="flex items-center gap-2">
					<!-- AI Mode Toggle -->
					<div class="flex items-center gap-2 mr-2">
						<span class="text-xs text-muted-foreground">Basic</span>
						<button
							class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {useAdvancedAI
								? 'bg-primary'
								: 'bg-input'}"
							onclick={() => (useAdvancedAI = !useAdvancedAI)}
							disabled={isLoading}
						>
							<span class="sr-only">Toggle AI mode</span>
							<span
								class="inline-block h-3 w-3 transform rounded-full bg-background shadow transition-transform {useAdvancedAI
									? 'translate-x-5'
									: 'translate-x-1'}"
							></span>
						</button>
						<span class="text-xs text-muted-foreground">Pro</span>
					</div>

					<Button variant="outline" size="sm" onclick={clearChat} disabled={isLoading}>
						Clear Chat
					</Button>
					<Button variant="ghost" size="sm" onclick={closeAssistant}>
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
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</Button>
				</div>
			</div>

			{#if !hasData}
				<!-- No Data State -->
				<div class="flex-1 flex items-center justify-center p-8">
					<div class="text-center space-y-4">
						<div
							class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-8 w-8 text-orange-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div>
							<h3 class="text-lg font-medium">No Data Available</h3>
							<p class="text-muted-foreground mt-1">
								Navigate to an analytics page with data to start analyzing.
							</p>
						</div>
					</div>
				</div>
			{:else}
				<!-- Chat Messages -->
				<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
					{#if messages.length === 0}
						<!-- Welcome Message -->
						<div class="flex flex-col items-center justify-center h-full space-y-4 text-center">
							<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-8 w-8 text-blue-600"
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
							</div>
							<div>
								<h3 class="text-lg font-medium">
									Ready to analyze your {getPageDisplayName(
										currentData?.pageType || ''
									).toLowerCase()}!
								</h3>
								<p class="text-muted-foreground mt-1">
									I can help you understand trends, patterns, and opportunities in your data.
								</p>
							</div>

							<!-- Quick Questions -->
							<div class="w-full max-w-2xl">
								<p class="text-sm font-medium mb-3">Try asking me:</p>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
									{#each getQuickQuestions(currentData?.pageType || '') as question}
										<Button
											variant="outline"
											size="sm"
											class="text-left justify-start h-auto py-2 px-3 whitespace-normal"
											onclick={() => sendMessage(question)}
											disabled={isLoading}
										>
											{question}
										</Button>
									{/each}
								</div>
							</div>
						</div>
					{:else}
						<!-- Chat Messages -->
						{#each messages as message}
							<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
								<div class="flex items-start gap-3 max-w-[80%]">
									{#if message.role === 'assistant'}
										<div
											class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 text-blue-600"
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
										</div>
									{/if}

									<div class="flex flex-col">
										<div
											class="rounded-lg px-4 py-2 {message.role === 'user'
												? 'bg-blue-600 text-white'
												: 'bg-muted border'}"
										>
											<div class="text-sm whitespace-pre-wrap">{message.content}</div>

											<!-- Function calls indicator for AI Pro responses -->
											{#if message.role === 'assistant' && message.functionCalls && useAdvancedAI}
												<div class="mt-2 pt-2 border-t border-muted-foreground/20">
													<div class="text-xs text-muted-foreground mb-1">
														🔧 AI Pro Tools Used:
													</div>
													{#each message.functionCalls as functionCall}
														<div class="text-xs bg-background/50 rounded px-2 py-1 mb-1">
															<strong>{functionCall.name.replace(/_/g, ' ')}</strong>
															{#if functionCall.error}
																<span class="text-red-500">❌ Error: {functionCall.error}</span>
															{:else}
																<span class="text-green-600">✅ Complete</span>
															{/if}
														</div>
													{/each}
												</div>
											{/if}
										</div>
										<div
											class="text-xs text-muted-foreground mt-1 {message.role === 'user'
												? 'text-right'
												: 'text-left'}"
										>
											{formatTime(message.timestamp)}
											{#if message.role === 'assistant' && useAdvancedAI}
												<span class="ml-2 text-purple-600">AI Pro</span>
											{/if}
										</div>
									</div>

									{#if message.role === 'user'}
										<div
											class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 text-gray-600"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
												/>
											</svg>
										</div>
									{/if}
								</div>
							</div>
						{/each}

						<!-- Loading Indicator -->
						{#if isLoading}
							<div class="flex justify-start">
								<div class="flex items-start gap-3">
									<div
										class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0"
									>
										<svg
											class="animate-spin h-4 w-4 text-blue-600"
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
									<div class="bg-muted border rounded-lg px-4 py-2">
										<div class="text-sm text-muted-foreground">Analyzing your data...</div>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</div>

				<!-- Error Display -->
				{#if error}
					<div class="px-4 py-2 bg-red-50 border-t border-red-200">
						<div class="flex items-center gap-2 text-red-700">
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
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span class="text-sm">{error}</span>
						</div>
					</div>
				{/if}

				<!-- Input Area -->
				<div class="border-t p-4">
					<div class="flex gap-2">
						<textarea
							bind:value={currentMessage}
							onkeydown={handleKeyPress}
							placeholder="Ask me about your data... (Press Enter to send, Shift+Enter for new line)"
							class="flex-1 min-h-[44px] max-h-32 px-3 py-2 border border-input rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
							disabled={isLoading}
							rows="1"
						></textarea>
						<Button
							onclick={() => sendMessage()}
							disabled={isLoading || !currentMessage.trim()}
							class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
						>
							{#if isLoading}
								<svg
									class="animate-spin h-4 w-4"
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
										d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
									/>
								</svg>
							{/if}
						</Button>
					</div>
					<div class="text-xs text-muted-foreground mt-2">
						💡 I can analyze trends, suggest improvements, and answer questions about your {getPageDisplayName(
							currentData?.pageType || ''
						).toLowerCase()}.
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
