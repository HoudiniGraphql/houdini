import type { Config, Document } from '../../../../lib'
import { generateDocumentTypes } from './documentTypes'
import imperativeCacheTypedef from './imperativeTypeDef'

// typescriptGenerator generates typescript definitions for the artifacts
export default async function typescriptGenerator(config: Config, docs: Document[]) {
	await Promise.all([
		generateDocumentTypes(config, docs),
		// write the imperative cache type definition
		imperativeCacheTypedef(config, docs),
	])
}
