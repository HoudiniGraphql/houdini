export { default as walkTaggedDocuments } from './walkTaggedDocuments'
export { default as artifactImport } from './artifactImport'
export type { EmbeddedGraphqlDocument } from './walkTaggedDocuments'

export function artifactIdentifier(artifact: { name: string }) {
	return `_${artifact.name}Artifact`
}
