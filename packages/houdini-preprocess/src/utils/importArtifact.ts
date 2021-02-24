import type { DocumentArtifact } from 'houdini'

export default function importArtifact(documentPath: string): Promise<DocumentArtifact> {
	return import(documentPath) as Promise<DocumentArtifact>
}
