import { HoudiniRTError } from '../lib/HoudiniRTError'
import { InfoReleaseNote, OutdatedFunctionInlineInfo } from '../lib/constants'
import { GraphQLTagResult, Operation } from '../lib/index'

export function mutation<_Mutation extends Operation<any, any>>(store: GraphQLTagResult) {
	// no longer exist!
	throw new HoudiniRTError('mutation', {
		type: 'OutdatedFunction',
		extraInfo: [
			OutdatedFunctionInlineInfo('mutation', store.artifact.name),
			InfoReleaseNote('#0160'),
		],
		quiet: true,
	})
}
