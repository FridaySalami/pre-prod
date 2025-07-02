<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		section: string;
		position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' | 'inline';
		size?: 'small' | 'medium' | 'large';
		variant?: 'floating' | 'button' | 'link';
		title?: string;
	}

	let {
		section,
		position = 'top-right',
		size = 'medium',
		variant = 'floating',
		title = 'View Documentation'
	}: Props = $props();

	function navigateToDocumentation() {
		goto(`/documentation?tab=${section}`);
	}

	// Get appropriate icon based on section
	function getIcon(section: string): string {
		const iconMap: Record<string, string> = {
			'landing-page': 'home',
			schedules: 'calendar_today',
			'employee-hours': 'schedule',
			analytics: 'analytics',
			database: 'storage',
			maintenance: 'build',
			troubleshooting: 'bug_report'
		};
		return iconMap[section] || 'help';
	}

	// Get section display name
	function getSectionName(section: string): string {
		const nameMap: Record<string, string> = {
			'landing-page': 'Landing Page',
			schedules: 'Schedule Management',
			'employee-hours': 'Employee Hours',
			analytics: 'Analytics Dashboard',
			database: 'Database Schema',
			maintenance: 'Maintenance Guide',
			troubleshooting: 'Troubleshooting'
		};
		return nameMap[section] || 'Documentation';
	}
</script>

{#if variant === 'floating'}
	<div class="doc-link-floating {position} {size}" {title}>
		<button class="doc-link-button floating" onclick={navigateToDocumentation}>
			<i class="material-icons-outlined doc-icon">{getIcon(section)}</i>
			{#if size === 'large'}
				<span class="doc-text">Docs</span>
			{/if}
		</button>
	</div>
{:else if variant === 'button'}
	<button class="doc-link-button {size}" onclick={navigateToDocumentation}>
		<i class="material-icons-outlined doc-icon">{getIcon(section)}</i>
		<span class="doc-text">{title}</span>
	</button>
{:else if variant === 'link'}
	<a href="/documentation?tab={section}" class="doc-link-text {size}">
		<i class="material-icons-outlined doc-icon">{getIcon(section)}</i>
		<span class="doc-text">{getSectionName(section)} Documentation</span>
	</a>
{/if}

<style>
	/* Floating Documentation Link */
	.doc-link-floating {
		position: fixed;
		z-index: 1000;
		opacity: 0.8;
		transition: opacity 0.2s ease;
	}

	.doc-link-floating:hover {
		opacity: 1;
	}

	/* Positioning */
	.doc-link-floating.top-right {
		top: 20px;
		right: 20px;
	}

	.doc-link-floating.bottom-right {
		bottom: 20px;
		right: 20px;
	}

	.doc-link-floating.top-left {
		top: 20px;
		left: 20px;
	}

	.doc-link-floating.bottom-left {
		bottom: 20px;
		left: 20px;
	}

	/* Button Styles */
	.doc-link-button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
	}

	.doc-link-button:hover {
		background: #2563eb;
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
	}

	.doc-link-button.floating {
		border-radius: 50%;
		padding: 12px;
		width: 48px;
		height: 48px;
		justify-content: center;
	}

	/* Sizes for floating buttons */
	.doc-link-floating.small .doc-link-button {
		width: 40px;
		height: 40px;
		padding: 10px;
	}

	.doc-link-floating.large .doc-link-button {
		width: auto;
		height: auto;
		padding: 12px 16px;
		border-radius: 24px;
		min-width: 80px;
	}

	/* Button sizes */
	.doc-link-button.small {
		padding: 6px 10px;
		font-size: 0.8rem;
	}

	.doc-link-button.large {
		padding: 12px 20px;
		font-size: 1rem;
	}

	/* Text Link Styles */
	.doc-link-text {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s ease;
		font-size: 0.9rem;
	}

	.doc-link-text:hover {
		color: #2563eb;
		text-decoration: underline;
	}

	.doc-link-text.small {
		font-size: 0.8rem;
		gap: 4px;
	}

	.doc-link-text.large {
		font-size: 1rem;
		gap: 8px;
	}

	/* Icon Styles */
	.doc-icon {
		font-size: 18px;
	}

	.small .doc-icon {
		font-size: 16px;
	}

	.large .doc-icon {
		font-size: 20px;
	}

	.doc-text {
		white-space: nowrap;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.doc-link-floating {
			bottom: 80px; /* Avoid conflict with mobile navigation */
		}

		.doc-link-floating.large .doc-link-button {
			min-width: 60px;
		}

		.doc-link-floating.large .doc-text {
			display: none;
		}
	}
</style>
