import { defineConfig } from '@junobuild/config';

export default defineConfig({
	satellite: {
		ids: {
			development: '<DEV_SATELLITE_ID>',
			production: 'dpl4s-kqaaa-aaaal-asg3a-cai'
		},
		source: 'build',
		predeploy: ['vp run build'],
		storage: {
			headers: [
				{
					source: '**/*.js',
					headers: [
						['Content-Type', 'application/javascript'],
						['Content-Encoding', 'gzip']
					]
				},
				{
					source: '**/*.mjs',
					headers: [
						['Content-Type', 'application/javascript'],
						['Content-Encoding', 'gzip']
					]
				},
				{
					source: '**/*.wasm',
					headers: [['Content-Type', 'application/wasm']]
				},
				{
					source: '**/*',
					headers: [
						[
							'Content-Security-Policy',
							"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; worker-src 'self' blob:;"
						],
						[
							'Permissions-Policy',
							'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
						]
					]
				}
			]
		}
	},
	orbiter: {
		id: 'p2pi7-hiaaa-aaaal-asaia-cai'
	}
});
