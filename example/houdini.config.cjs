const path = require('path')

module.exports = {
	schemaPath: path.resolve('./schema/introspection.json'),
	sourceGlob: 'src/**/*.svelte',
	mode: 'kit'
}
