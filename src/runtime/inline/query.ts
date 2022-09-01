import { getSiteUrl } from '../../common/constants'
import { GraphQLTagResult, Operation } from '../lib/types'

export function query<_Query extends Operation<any, any>>(store: GraphQLTagResult) {
	// no longer exist!
	throw new Error(
		`inline query( ... ) no longer exist, check this guide: ${getSiteUrl()}/guides/release-notes#0160`
	)
}

export function paginatedQuery<_Query extends Operation<any, any>>(document: GraphQLTagResult) {
	// no longer exist!
	throw new Error(
		`inline paginatedQuery( ... ) no longer exist, check this guide: ${getSiteUrl()}/guides/release-notes#0160`
	)
}
