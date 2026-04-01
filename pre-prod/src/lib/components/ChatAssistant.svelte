<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Card, CardHeader, CardTitle, CardContent, Button } from '$lib/shadcn/components';

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
	}

	interface Props {
		analyticsData: any;
		isVisible: boolean;
		onClose: () => void;
	}

	let { analyticsData, isVisible, onClose }: Props = $props();

	// State
	let messages: ChatMessage[] = $state([]);
	let currentMessage = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let chatContainer: HTMLElement | undefined = $state();

	const dispatch = createEventDispatcher();

	// Predefined quick questions
	const quickQuestions = [
		'What are the key trends in this data?',
		'Which sales channel is performing best?',
		'Are there any concerning patterns I should know about?',
		'What recommendations do you have for improvement?',
		'How does labor efficiency correlate with sales?',
		'What should I focus on this month?'
	];

	/**
	 * Send message to ChatGPT API
	 */
	async function sendMessage(messageText?: string) {
		const textToSend = messageText || currentMessage.trim();

		if (!textToSend || isLoading) return;

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
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: textToSend,
					analyticsData
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
				timestamp: new Date()
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
					<h2 class="text-lg font-semibold">AI Data Analysis Assistant</h2>
				</div>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={clearChat} disabled={isLoading}>
						Clear Chat
					</Button>
					<Button variant="ghost" size="sm" onclick={onClose}>
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
							<h3 class="text-lg font-medium">Welcome to your AI Data Assistant!</h3>
							<p class="text-muted-foreground mt-1">
								I can help you analyze your business data and provide insights.
							</p>
						</div>

						<!-- Quick Questions -->
						<div class="w-full max-w-2xl">
							<p class="text-sm font-medium mb-3">Try asking me:</p>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
								{#each quickQuestions as question}
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
									</div>
									<div
										class="text-xs text-muted-foreground mt-1 {message.role === 'user'
											? 'text-right'
											: 'text-left'}"
									>
										{formatTime(message.timestamp)}
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
					💡 I can analyze trends, suggest improvements, and answer questions about your analytics
					data.
				</div>
			</div>
		</div>
	</div>
{/if}
