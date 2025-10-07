import type { Config, Document } from '../../../../lib'
import { generateDocumentTypes } from './documentTypes'

// typescriptGenerator generates typescript definitions for the artifacts
export default async function typescriptGenerator(config: Config, docs: Document[]) {
	await Promise.all([
		generateDocumentTypes(config, docs),
	])
}
