import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		files: ['**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		},
		rules: {
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'static/',
			'scripts/',
			'**/*.test.ts',
			'**/*.spec.ts',
			'src/lib/components/test-setup.ts',
			'src/lib/components/test-utils.ts',
			'*.config.ts',
			'juno.config.ts',
			'repro_validation.ts',
			'src/app.d.ts'
		]
	},
	{
		files: ['**/*.ts', '**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
				extraFileExtensions: ['.svelte']
			}
		},
		rules: {
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-unused-expressions': 'warn',
			'no-case-declarations': 'off',
			'no-async-promise-executor': 'warn',
			'prefer-const': 'warn',
			'svelte/require-each-key': 'warn',
			'svelte/no-unused-props': 'warn',
			'svelte/prefer-svelte-reactivity': 'warn',
			'svelte/prefer-writable-derived': 'warn'
		}
	},
	{
		files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
		rules: {
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-misused-promises': 'off'
		}
	},
	{
		rules: {
			'svelte/no-at-html-tags': 'error',
			'no-control-regex': 'off'
		}
	}
);
