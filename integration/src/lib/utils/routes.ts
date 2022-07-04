export const routes = {
  Home: '/',
  GraphQL: 'http://localhost:4000/graphql',

  Stores_SSR: '/stores/ssr',
  Stores_Network: '/stores/network',
  Stores_SSR_UserId_2: '/stores/ssr-2',
  Stores_Prefetch_UserId_2: '/stores/prefetch-2',
  Stores_SSR_Session: '/stores/ssr-session',
  Stores_Network_Session: '/stores/network-session',
  Stores_Mutation: '/stores/mutation',
  Stores_Mutation_Update: '/stores/mutation-update',
  Stores_Mutation_Scalars: '/stores/mutation-scalars',
  Stores_Network_One_Store_Multivariables: '/stores/network-one-store-multivariables',
  Stores_SSR_One_Store_Multivariables: '/stores/ssr-one-store-multivariables',
  Stores_Fragment_Null: '/stores/fragment-null',
  Stores_Metadata: '/stores/metadata',

  Preprocess_query_simple: '/preprocess/query/simple',
  Preprocess_query_variable_1: '/preprocess/query/variable-1',
  Preprocess_query_variable_2: '/preprocess/query/variable-2',
  Preprocess_query_variable_error: '/preprocess/query/variables-error',
  Preprocess_query_multiple: '/preprocess/query/multiple',
  Preprocess_query_scalars: '/preprocess/query/scalars',
  Preprocess_query_component: '/preprocess/query/component',
  Preprocess_query_beforeLoad: '/preprocess/query/beforeLoad',
  Preprocess_query_afterLoad: '/preprocess/query/afterLoad',

  Preprocess_mutation_mutation: '/preprocess/mutation/mutation',
  Preprocess_fragment_update: '/preprocess/fragment/update',

  Pagination_query_forward_cursor: '/pagination/query/forward-cursor',
  Pagination_query_backwards_cursor: '/pagination/query/backwards-cursor',
  Pagination_query_offset: '/pagination/query/offset',

  Pagination_fragment_forward_cursor: '/pagination/fragment/forward-cursor',
  Pagination_fragment_backwards_cursor: '/pagination/fragment/backwards-cursor',
  Pagination_fragment_offset: '/pagination/fragment/offset',

  Stores_subunsub_list: '/stores/subunsub-list',
  Stores_subunsub_mutation: '/stores/subunsub-mutation'
};
