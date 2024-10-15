module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:svelte/recommended'
  ],
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['*.cjs', '$houdini/**'],
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    }
  ],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    extraFileExtensions: ['.svelte']
  },
  env: {
    browser: true,
    es2017: true,
    node: true
  },
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    // Disable svelte-check, as we already have that as a separate step
    'svelte/valid-compile': 'off',
    // With component queries, it is valid to have e.g. props that are only used through the _QueryVariables function.
    '@typescript-eslint/no-unused-vars': 'off'
  }
};
