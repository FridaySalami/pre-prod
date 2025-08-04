import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		noExternal: ['openai'],
		// Include Prisma client for proper ESM handling
		external: ['@prisma/client', 'crypto', 'aws4']
	},
	optimizeDeps: {
		exclude: ['@prisma/client']
	}
});
