import { Config, fs } from '../../../lib'
import enums from './enums'

// schemaGenerator updates the schema file to contain all of the generated
export default async function schemaGenerator(config: Config) {
	await Promise.all([
		fs.writeFile(config.definitionsSchemaPath, config.newSchema),
		fs.writeFile(config.definitionsDocumentsPath, config.newDocuments),
		enums(config),
	])
}
