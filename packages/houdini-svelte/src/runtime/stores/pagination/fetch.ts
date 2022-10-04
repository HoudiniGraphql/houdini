import { GraphQLObject, QueryResult } from '$houdini/runtime/lib/types'

import { QueryStoreFetchParams } from '../query'

export type FetchFn<_Data extends GraphQLObject, _Input = any> = (
	params?: QueryStoreFetchParams<_Data, _Input>
) => Promise<QueryResult<_Data, _Input>>
