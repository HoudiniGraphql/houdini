import { QueryResult, QueryStoreFetchParams } from '../query'

export type FetchFn<_Data = any, _Input = any> = (
	params?: QueryStoreFetchParams<_Input>
) => Promise<QueryResult<_Data, _Input>>
