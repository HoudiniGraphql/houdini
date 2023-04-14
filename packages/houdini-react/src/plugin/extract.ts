import type { Config } from 'houdini'
import { find_graphql, parseJS } from 'houdini'

export async function extractDocuments({
	content,
	config,
	filepath,
}: {
	config: Config
	content: string
	filepath: string
}) {
	// the documents  we've found
	const documents: string[] = []

	// only consider tsx and jsx files
	if (!filepath.endsWith('.tsx') && !filepath.endsWith('.jsx')) {
		return []
	}

	// parse the content
	const parsed = await parseJS(content)

	// use the houdini utility to search for the graphql functions
	await find_graphql(config, parsed, {
		tag(tag) {
			documents.push(tag.tagContent)
		},
	})

	return documents
}
