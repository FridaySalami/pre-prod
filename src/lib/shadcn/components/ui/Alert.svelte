<!-- Alert.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';
	import { tv, type VariantProps } from 'tailwind-variants';

	const alertVariants = tv({
		base: 'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
		variants: {
			variant: {
				default: 'bg-background text-foreground',
				destructive:
					'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
				success:
					'border-green-500/50 text-green-700 bg-green-50 dark:border-green-500 [&>svg]:text-green-600',
				warning:
					'border-yellow-500/50 text-yellow-800 bg-yellow-50 dark:border-yellow-500 [&>svg]:text-yellow-600',
				info: 'border-blue-500/50 text-blue-700 bg-blue-50 dark:border-blue-500 [&>svg]:text-blue-600'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	type Variant = VariantProps<typeof alertVariants>['variant'];

	let className: string = '';
	export { className as class };
	export let variant: Variant = 'default';
</script>

<div role="alert" class={cn(alertVariants({ variant }), className)} {...$$restProps}>
	<slot />
</div>
