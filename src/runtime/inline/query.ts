import { HoudiniRTError } from '../lib/HoudiniRTError'
import { getSiteUrl, InfoReleaseNote, OutdatedFunctionInlineInfo } from '../lib/constants'
import { GraphQLTagResult, Operation } from '../lib/types'

export function query<_Query extends Operation<any, any>>(store: GraphQLTagResult) {
	// no longer exist!
	throw new HoudiniRTError('query', {
		type: 'OutdatedFunction',

		extraInfo: [
			OutdatedFunctionInlineInfo('query', store.artifact.name),
			InfoReleaseNote('#0160'),
		],
		quiet: true,
	})
}

export function paginatedQuery<_Query extends Operation<any, any>>(store: GraphQLTagResult) {
	// no longer exist!
	throw new HoudiniRTError('paginatedQuery', {
		type: 'OutdatedFunction',
		extraInfo: [
			OutdatedFunctionInlineInfo('paginatedQuery', store.artifact.name),
			InfoReleaseNote('#0160'),
		],
		quiet: true,
	})
}
