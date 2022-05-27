import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

export async function generateFragmentStore(config: Config, doc: CollectedGraphQLDocument) {
	const storeName = config.storeName(doc)

	return storeName
}
