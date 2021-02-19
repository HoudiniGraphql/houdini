import { DocumentArtifact } from 'houdini-compiler'

export default function importArtifact(documentPath: string): Promise<DocumentArtifact> {
	return import(documentPath) as Promise<DocumentArtifact>
}
