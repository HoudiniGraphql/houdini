import { getSiteUrl } from '../../common/constants'
import { GraphQLTagResult, Operation } from '../lib/index'

export function mutation<_Mutation extends Operation<any, any>>(store: GraphQLTagResult) {
	// no longer exist!
	throw new Error(
		`inline mutation( ... ) no longer exist, check this guide: ${getSiteUrl()}/guides/release-notes#0160`
	)
}
