import { Document, type Config, type ProjectManifest } from 'houdini'

export async function generate_componentFieldBundles({
	config,
	documents,
}: {
	config: Config
	documents: Document[]
}): Promise<void> {
	// every document that has a component field will need to import a file
	// that ensures the component fields are bundled with the rest of the code
	// _before_ the query is triggered
}
