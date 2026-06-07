import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'
import sveltePlugin from 'eslint-plugin-svelte'

export default [
	{
		ignores: ['**/*.cjs', '**/$houdini/**', '.houdini/**', '.svelte-kit/**', 'build/**'],
	},
	...tsPlugin.configs['flat/recommended'],
	...sveltePlugin.configs['flat/recommended'],
	...sveltePlugin.configs['flat/prettier'],
	prettierConfig,
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser,
			},
		},
	},
	{
		rules: {
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'svelte/no-immutable-reactive-statements': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/no-useless-mustaches': 'off',
			'svelte/require-each-key': 'off',
			'svelte/valid-compile': 'off',
		},
	},
]
