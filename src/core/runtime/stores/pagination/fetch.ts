import { GraphQLObject } from '../../lib'
import { QueryResult, QueryStoreFetchParams } from '../query'

export type FetchFn<_Data extends GraphQLObject, _Input = any> = (
	params?: QueryStoreFetchParams<_Data, _Input>
) => Promise<QueryResult<_Data, _Input>>
