export const routes = {
	hello: '/hello-world',
	scalars: '/scalars',
	componentFields_simple: '/component_fields/simple',
	componentFields_arguments: '/component_fields/arguments',
	route_params: '/route_params/1',
	handle_1: '/handle/1',
	handle_2: '/handle/2',
	pagination_query_backwards: '/pagination/query/connection-backwards',
	pagination_query_forwards: '/pagination/query/connection-forwards',
	pagination_query_bidirectional: '/pagination/query/connection-bidirectional',
	pagination_query_offset: '/pagination/query/offset',
	pagination_query_offset_singlepage: '/pagination/query/offset-singlepage',
	pagination_query_offset_variable: '/pagination/query/offset-variable/2',
	optimistic_keys: '/optimistic-keys',
	double_insert: '/double-insert'
} as const
