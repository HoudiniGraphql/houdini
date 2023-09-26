import type { Config, ProjectManifest, PageManifest, Document } from 'houdini'

import { generate_routing_document_wrappers } from './documentWrappers'
import { generate_fallbacks } from './fallbacks'
import { generate_page_entries } from './pages'

export async function generate_entries({
	config,
	manifest,
	documents,
}: {
	config: Config
	manifest: ProjectManifest
	documents: Document[]
}) {
	// we need a mapping of every document in the project
	const document_map = documents.reduce(
		(prev, doc) => ({ ...prev, [doc.name]: doc }),
		{} as Record<string, Document>
	)

	await Promise.all([
		...Object.entries(manifest.pages).map(([id, page]) =>
			generate_page_entries({ id, page, config, project: manifest, documents: document_map })
		),
		generate_routing_document_wrappers({ config, manifest, documents: document_map }),
		generate_fallbacks({ config, project: manifest }),
	])
}

export type PageBundleInput = {
	id: string
	page: PageManifest
	project: ProjectManifest
	config: Config
	documents: Record<string, Document>
}
