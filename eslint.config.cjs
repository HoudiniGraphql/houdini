const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const unusedImports = require('eslint-plugin-unused-imports');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const unicorn = require('eslint-plugin-unicorn');
const sonarjs = require('eslint-plugin-sonarjs');
const importPlugin = require('eslint-plugin-import');
const promise = require('eslint-plugin-promise');
const n = require('eslint-plugin-n');

module.exports = [
	// Global ignores
	{
		ignores: ['e2e/**', 'example/**', 'site/**', 'node_modules/**', 'dist/**', 'build/**']
	},

	// Base configuration for all files
	{
		files: ['**/*.{js,mjs,cjs,ts,tsx}'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true
				}
			},
			globals: {
				console: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				global: 'readonly',
				module: 'readonly',
				require: 'readonly',
				exports: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': tseslint,
			'unused-imports': unusedImports,
			react: react,
			'react-hooks': reactHooks,
			unicorn: unicorn,
			sonarjs: sonarjs,
			import: importPlugin,
			promise: promise,
			n: n
		},
		rules: {
			// ESLint recommended rules
			...js.configs.recommended.rules,

			// TypeScript ESLint recommended rules (manually specified key ones)
			'@typescript-eslint/no-unused-vars': 'off', // Disabled as per your config
			'@typescript-eslint/no-explicit-any': 'off', // Disabled as per your config
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/ban-types': 'off',
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/prefer-as-const': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/triple-slash-reference': 'off',
			'@typescript-eslint/no-empty-interface': 'off',
			'@typescript-eslint/no-namespace': 'off',
			'@typescript-eslint/prefer-optional-chain': 'off',

			// Your custom TypeScript rules
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
					fixStyle: 'separate-type-imports',
				},
			],

			// Unused imports
			'unused-imports/no-unused-imports': 'error',

			// Disabled rules as per your config
			'unicorn/no-lonely-if': 'off',
			'unicorn/filename-case': 'off',
			'unicorn/no-instanceof-array': 'off',
			'unicorn/prefer-includes': 'off',
			'unicorn/no-negated-condition': 'off',
			'unicorn/numeric-separators-style': 'off',
			'unicorn/no-useless-spread': 'off',

			'import/no-default-export': 'off',
			'import/extensions': 'off',

			'sonarjs/no-gratuitous-expressions': 'off',

			'no-lonely-if': 'off',
			'no-console': 'off',
			'prefer-arrow-callback': 'off',
			'prefer-const': 'off',
			'no-else-return': 'off',
			'no-empty': 'off',
			'no-var': 'off',
			'no-undef': 'off',
			'object-shorthand': 'off',
			'logical-assignment-operators': 'off',
			'no-implicit-coercion': 'off',
			'no-restricted-syntax': 'off'
		}
	},

	// TypeScript specific configuration
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: true,
				tsconfigRootDir: __dirname
			}
		}
	},

	// React specific configuration
	{
		files: ['**/*.{jsx,tsx}'],
		settings: {
			react: {
				version: 'detect'
			}
		},
		rules: {
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules
		}
	},

	// CommonJS files
	{
		files: ['**/*.{cjs,cts}'],
		languageOptions: {
			globals: {
				require: 'readonly',
				module: 'readonly',
				exports: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly'
			}
		},
		rules: {
			'@typescript-eslint/no-var-requires': 'off'
		}
	}
];
