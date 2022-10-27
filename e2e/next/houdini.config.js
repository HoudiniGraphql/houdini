module.exports = {
	schemaPath: '../_api/*.graphql',
	include: './app/**/*.{jsx,tsx}',
	plugins: {
		'houdini-react': {
			client: './client.ts',
		},
	},
}
