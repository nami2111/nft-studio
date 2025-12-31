import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['./src/lib/components/test-setup.ts'],
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			thresholds: {
				statements: 70,
				branches: 70,
				functions: 70,
				lines: 70
			},
			exclude: [
				'node_modules/',
				'src/lib/components/test-setup.ts',
				'src/lib/components/test-utils.ts',
				'*.test.ts',
				'*.config.*',
				'dist/',
				'build/'
			]
		}
	},
	optimizeDeps: {
		esbuildOptions: {
			define: {
				global: 'globalThis',
				window: 'globalThis',
				document: 'globalThis.document',
				navigator: 'globalThis.navigator'
			}
		}
	}
});
