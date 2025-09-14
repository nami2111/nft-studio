import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
	plugins: [
		sveltekit(),
		// Temporarily disable Juno for bundle analysis
		// juno(),
		tailwindcss(),
		visualizer({
			filename: 'stats.html',
			open: false,
			gzipSize: true,
			brotliSize: true
		})
	],
	optimizeDeps: {
		esbuildOptions: {
			define: {
				global: 'globalThis'
			},
			plugins: [
				{
					name: 'fix-node-globals-polyfill',
					setup(build) {
						build.onResolve({ filter: /_virtual-process-polyfill_\.js/ }, ({ path }) => ({ path }));
					}
				}
			]
		}
	},
	worker: {
		plugins: () => [sveltekit()],
		format: 'es'
	}
});
