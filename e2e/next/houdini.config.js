module.exports = {
	schemaPath: '../_api/*.graphql',
	plugins: {
		'houdini-react': {
			client: './client.ts',
		},
	},
}
