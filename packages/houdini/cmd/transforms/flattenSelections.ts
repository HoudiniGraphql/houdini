import { Config } from 'houdini-common'
import { CollectedGraphQLDocument } from '..'

// flattenSelections turns every documents selection into a single flat object (merging selections and de-duping fields)
export default async function flattenSelections(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	for (const doc of documents) {
		// if we are looking at a fragment document, the first fragment in the list is the right one
		// ADD DOCUMENT KIND TO COLLECTED DOCUMENT
	}
}
