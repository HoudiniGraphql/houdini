import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
	{
		ignores: ['.houdini/**', 'build/**', 'node_modules/**'],
	},
	{
		files: ['src/**/*.{ts,tsx}'],
		plugins: { '@typescript-eslint': tsPlugin },
		languageOptions: {
			parser: tsParser,
		},
		rules: {
			'@typescript-eslint/ban-ts-comment': ['error', {
				'ts-ignore': true,
				'ts-expect-error': 'allow-with-description',
				'ts-nocheck': true,
			}],
		},
	},
]
