<script lang="ts">
	import { enhance } from '$app/forms';

	export let value: any;
	export let id: string;
	export let field: string;

	let submitting = false;
</script>

<form
	method="POST"
	action="?/update"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			submitting = false;
			// Don't reset the form, keep the new value
			update({ reset: false });
		};
	}}
	class="w-full"
>
	<input type="hidden" name="id" value={id} />
	<input type="hidden" name="field" value={field} />
	<input
		type="text"
		name="value"
		bind:value
		class="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 transition-colors {submitting
			? 'opacity-50'
			: ''}"
		on:change={(e) => e.currentTarget.form?.requestSubmit()}
	/>
</form>
