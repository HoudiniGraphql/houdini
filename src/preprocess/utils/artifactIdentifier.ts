export default function artifactIdentifier(artifact: { name: string }) {
	return `_${artifact.name}Artifact`
}
