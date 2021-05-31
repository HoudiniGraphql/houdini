import path from 'path'

export default {
	schemaPath: path.resolve('./schema/schema.gql'),
	sourceGlob: 'src/**/*.svelte',
	mode: 'kit',
	apiUrl: 'http://localhost:4000/graphql',
}
