import juno from "@junobuild/vite-plugin";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vite-plus";

export default defineConfig({
	resolve: {
		conditions: ["browser"],
	},
	plugins: [
		juno(),
		sveltekit(),
		tailwindcss(),
		SvelteKitPWA({
			registerType: "autoUpdate",
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2,json}"],
				globIgnores: ["**/node_modules/**/*"],
				navigateFallback: "/",
				navigateFallbackDenylist: [
					/^\/_app\/.*/,
					/^\/api\/.*/,
					/^\/manifest\.webmanifest$/,
				],
				skipWaiting: true,
				clientsClaim: true,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "google-fonts-cache",
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "gstatic-fonts-cache",
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
			},
			manifest: {
				name: "GNStudio",
				short_name: "GNStudio",
				description:
					"Design and generate generative art collections with layers, traits, and rarity",
				theme_color: "#3b82f6",
				background_color: "#ffffff",
				display: "standalone",
				start_url: "/",
				icons: [
					{
						src: "pwa-64x64.png",
						sizes: "64x64",
						type: "image/png",
					},
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
				categories: ["productivity", "utilities", "art"],
				lang: "en",
				orientation: "portrait-primary",
			},
			injectRegister: "script",
			devOptions: {
				enabled: true,
				suppressWarnings: true,
				type: "module",
			},
		}),
	],
	optimizeDeps: {
		rolldownOptions: {
			transform: {
				define: {
					global: "globalThis",
				},
			},
		},
	},
	worker: {
		plugins: () => [sveltekit()],
		format: "es",
	},
	server: {
		fs: {
			allow: [".."],
		},
	},
	test: {
		include: ["src/**/*.{test,spec}.{js,ts}"],
		environment: "jsdom",
		setupFiles: ["./src/lib/components/test-setup.ts"],
		globals: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			thresholds: {
				statements: 40,
				branches: 33,
				functions: 48,
				lines: 40,
			},
			exclude: [
				"node_modules/",
				"src/lib/components/test-setup.ts",
				"src/lib/components/test-utils.ts",
				"*.test.ts",
				"*.config.*",
				"dist/",
				"build/",
			],
		},
	},
	lint: {
		ignorePatterns: [
			"build/**",
			".svelte-kit/**",
			"dist/**",
			"static/**",
			"scripts/**",
			"**/*.test.ts",
			"**/*.spec.ts",
			"src/lib/components/test-setup.ts",
			"src/lib/components/test-utils.ts",
			"*.config.ts",
			"juno.config.ts",
			"repro_validation.ts",
			"src/app.d.ts",
		],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		rules: {
			"@typescript-eslint/no-unused-vars": "warn",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-unused-expressions": "warn",
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-misused-promises": "off",
			"@typescript-eslint/no-redundant-type-constituents": "off",
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/no-base-to-string": "off",
			"@typescript-eslint/await-thenable": "warn",
			"@typescript-eslint/require-array-sort-compare": "off",
			"no-async-promise-executor": "warn",
			"no-control-regex": "off",
			"no-case-declarations": "off",
			"no-unassigned-vars": "off",
			"unicorn/no-useless-fallback-in-spread": "off",
			"prefer-const": "warn",
		},
		overrides: [
			{
				files: ["*.svelte"],
				rules: {
					"prefer-const": "off",
					"no-unassigned-vars": "off",
				},
			},
		],
	},
	fmt: {
		singleQuote: true,
		semi: true,
		useTabs: true,
		trailingComma: "none",
		ignorePatterns: [
			"pnpm-lock.yaml",
			"package-lock.json",
			"yarn.lock",
			"stats.html",
		],
	},
});
