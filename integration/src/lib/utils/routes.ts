export const routes = {
  Home: '/',
  GraphQL: 'http://localhost:4000/graphql',

  Stores_SSR: '/stores/ssr',
  Stores_Network: '/stores/network',
  Stores_SSR_UserId_2: '/stores/ssr-2',
  Stores_SSR_Session: '/stores/ssr-session',
  Stores_Network_Session: '/stores/network-session',
  Stores_Mutation: '/stores/mutation',
  Stores_Mutation_Update: '/stores/mutation-update',
  Stores_Mutation_Scalars: '/stores/mutation-scalars',

  Preprocess_query_simple: '/preprocess/query/simple',
  Preprocess_query_variable_1: '/preprocess/query/variable/1',
  Preprocess_query_variable_2: '/preprocess/query/variable/2',
  Preprocess_query_multiple: '/preprocess/query/multiple',
  Preprocess_query_scalars: '/preprocess/query/scalars',

  Preprocess_mutation_mutation: '/preprocess/mutation/mutation',
  Preprocess_fragment_update: '/preprocess/fragment/update',

  Pagination_query_forward_cursor: '/pagination/query/forward-cursor',
  Pagination_query_backwards_cursor: '/pagination/query/backwards-cursor',
  Pagination_query_offset: '/pagination/query/offset',

  Pagination_fragment_forward_cursor: '/pagination/fragment/forward-cursor',
  Pagination_fragment_backwards_cursor: '/pagination/fragment/backwards-cursor',
  Pagination_fragment_offset: '/pagination/fragment/offset'
};
