import { HoudiniRTError } from '../lib/HoudiniRTError'
import { InfoReleaseNote, OutdatedFunctionInlineInfo } from '../lib/constants'
import { GraphQLTagResult, Operation } from '../lib/types'

export function subscription<_Subscription extends Operation<any, any>>(
	store: GraphQLTagResult,
	variables?: _Subscription['input']
) {
	// no longer exist!
	throw new HoudiniRTError('subscription', {
		type: 'OutdatedFunction',
		extraInfo: [
			OutdatedFunctionInlineInfo('subscription', store.artifact.name),
			InfoReleaseNote('#0160'),
		],
		quiet: true,
	})
}
