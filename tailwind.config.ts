import type { Config } from 'tailwindcss';

const config: Config = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border) / <alpha-value>)',
				input: 'hsl(var(--input) / <alpha-value>)',
				ring: 'hsl(var(--ring) / <alpha-value>)',
				background: 'hsl(var(--background) / <alpha-value>)',
				foreground: 'hsl(var(--foreground) / <alpha-value>)',
				primary: {
					DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
					foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
					foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
					foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
					foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
					foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
					foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
				},
				card: {
					DEFAULT: 'hsl(var(--card) / <alpha-value>)',
					foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
					foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
					primary: 'hsl(var(--sidebar-primary) / <alpha-value>)',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
					accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
					border: 'hsl(var(--sidebar-border) / <alpha-value>)',
					ring: 'hsl(var(--sidebar-ring) / <alpha-value>)'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			fontFamily: {
				sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
				mono: ['var(--font-mono)', 'monospace']
			},
			screens: {
				xs: '480px',
				sm: '640px',
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1400px'
			},
			spacing: {
				xs: 'var(--space-xs)',
				sm: 'var(--space-sm)',
				md: 'var(--space-md)',
				lg: 'var(--space-lg)',
				xl: 'var(--space-xl)',
				'2xl': 'var(--space-2xl)'
			},
			fontSize: {
				xs: ['var(--font-size-xs)', { lineHeight: 'var(--line-height-normal)' }],
				sm: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-normal)' }],
				base: ['var(--font-size-base)', { lineHeight: 'var(--line-height-normal)' }],
				lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-normal)' }],
				xl: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-normal)' }],
				'2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-tight)' }],
				'3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-tight)' }],
				'4xl': ['var(--font-size-4xl)', { lineHeight: 'var(--line-height-tight)' }],
				'5xl': ['var(--font-size-5xl)', { lineHeight: 'var(--line-height-tight)' }]
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: []
};

export default config;
