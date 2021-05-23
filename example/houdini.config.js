import path from 'path'

export default {
	schemaPath: path.resolve('./schema/introspection.json'),
	// You can use .gql or .graphql schemas too.
	// schemaPath: path.resolve('./schema/schema.gql'),
	sourceGlob: 'src/**/*.svelte',
	mode: 'kit',
	apiUrl: 'http://localhost:4000/graphql',
}
