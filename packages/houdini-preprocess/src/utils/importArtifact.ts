import type { DocumentArtifact } from 'houdini'
import type { Config } from 'houdini-common'

export default function importArtifact(
	config: Config,
	documentPath: string
): Promise<DocumentArtifact> {
	return import(documentPath) as Promise<DocumentArtifact>
}
