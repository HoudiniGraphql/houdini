// externals
// locals
import { Config } from '../../../common'
import { writeFile } from '../../utils'

// schemaGenerator updates the schema file to contain all of the generated
export default async function schemaGenerator(config: Config) {
	if (config.newSchema) {
		await writeFile(config.definitionsSchemaPath, config.newSchema)
	}

	if (config.newDocuments) {
		await writeFile(config.definitionsDocumentsPath, config.newDocuments)
	}
}
