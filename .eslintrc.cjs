module.exports = {
	root: true,
	extends: '@theguild',
	rules: {
		'@typescript-eslint/no-unused-vars': 'off',
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-empty-function': 'off',
		'@typescript-eslint/ban-types': 'off',
		'@typescript-eslint/no-inferrable-types': 'off',
		'@typescript-eslint/no-this-alias': 'off',
		'@typescript-eslint/prefer-as-const': 'off',
		'@typescript-eslint/no-var-requires': 'off',
		'unicorn/no-lonely-if': 'off',
		'unicorn/filename-case': 'off',
		'unicorn/no-instanceof-array': 'off',
		'unicorn/prefer-includes': 'off',
		'import/no-default-export': 'off',
		'sonarjs/no-gratuitous-expressions': 'off',
		'no-lonely-if': 'off',
		'no-console': 'off',
		'prefer-arrow-callback': 'off',
		'prefer-const': 'off',
		'no-else-return': 'off',
		'no-empty': 'off',
		'no-var': 'off',
		'no-undef': 'off',
		// 'import/no-cycle': [2, { maxDepth: 1 }],
		// 'no-console': ['error', { allow: ['info', 'warn', 'error', 'time', 'timeEnd'] }],
	},
	ignorePatterns: ['integration', 'example'],
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020,
	},
}
