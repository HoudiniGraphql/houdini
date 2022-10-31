module.exports = {
	schemaPath: '../_api/*.graphql',
	include: './app/**/*.{jsx,tsx}',
	module: 'commonjs',
	plugins: {
		'houdini-react': {
			client: './client.ts',
		},
	},
}
