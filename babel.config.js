module.exports = {
	presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
	env: {
		test: {
			plugins: ['@babel/plugin-syntax-import-meta'],
		},
	},
}
