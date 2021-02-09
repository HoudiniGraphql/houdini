const path = require('path')

module.exports = {
	runtimeDirectory: path.resolve('./generated'),
	schemaPath: path.resolve('./schema/introspection.json'),
	sourceGlob: 'src/{routes,components}/*.svelte',
}
