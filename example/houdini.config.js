import path from 'path'

export default {
	schemaPath: path.resolve('./schema/introspection.json'),
	sourceGlob: 'src/**/*.svelte',
	mode: 'kit',
}
