import { getSiteUrl } from '../../common/constants'
import { GraphQLTagResult, Operation } from '../lib/types'

export function subscription<_Subscription extends Operation<any, any>>(
	store: GraphQLTagResult,
	variables?: _Subscription['input']
) {
	// no longer exist!
	throw new Error(
		`inline mutation( ... ) no longer exist, check this guide: ${getSiteUrl()}/guides/release-notes#0160`
	)
}
