// externals
import type { Config } from 'houdini-common'
// locals
import { MutationArtifact, QueryArtifact, SubscriptionArtifact } from './types'

export function marshalInputs({
	artifact,
	config,
	input,
}: {
	artifact: QueryArtifact | MutationArtifact | SubscriptionArtifact
	config: Config
	input: {}
}) {
	console.log(artifact.input)
	return input
}
