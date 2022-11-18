export const routes = {
  Home: '/',
  GraphQL: 'http://localhost:4000/graphql',

  // features
  Query_param: '/query-param',
  isFetching_with_load: '/isFetching/with_load',
  isFetching_without_load: '/isFetching/without_load',
  isFetching_route_1: '/isFetching/route_1',
  lists_all: '/lists-all?limit=15',

  Stores_SSR: '/stores/ssr',
  Stores_Network: '/stores/network',
  Stores_SSR_UserId_2: '/stores/ssr-2',
  Stores_Prefetch_UserId_2: '/stores/prefetch-2',
  Stores_Mutation: '/stores/mutation',
  Stores_Mutation_Update: '/stores/mutation-update',
  Stores_Mutation_Scalars: '/stores/mutation-scalars',
  Stores_Mutation_Scalar_Single_Upload: '/stores/mutation-scalar-single-upload',
  Stores_Mutation_Scalar_Multi_Upload: '/stores/mutation-scalar-multi-upload',
  Stores_Mutation_Enums: '/stores/mutation-enums',
  Stores_Network_One_Store_Multivariables: '/stores/network-one-store-multivariables',
  Stores_SSR_One_Store_Multivariables: '/stores/ssr-one-store-multivariables',
  Stores_Fragment_Null: '/stores/fragment-null',
  Stores_Metadata: '/stores/metadata',
  Stores_Endpoint_Query: '/stores/endpoint-query',
  Stores_Endpoint_Mutation: '/stores/endpoint-mutation',
  Stores_Session: '/stores/session',

  Stores_Partial_List: '/stores/partial/partial_List',
  Stores_Pagination_query_forward_cursor: '/stores/pagination/query/forward-cursor',

  Plugin_query_simple: '/plugin/query/simple',
  Plugin_query_variable_1: '/plugin/query/variable-1',
  Plugin_query_variable_2: '/plugin/query/variable-2',
  Plugin_query_variable_error: '/plugin/query/variables-error',
  Plugin_query_multiple: '/plugin/query/multiple',
  Plugin_query_scalars: '/plugin/query/scalars',
  Plugin_query_component: '/plugin/query/component',
  Plugin_query_beforeLoad: '/plugin/query/beforeLoad',
  Plugin_query_afterLoad: '/plugin/query/afterLoad',
  Plugin_query_onError: '/plugin/query/onError',
  Plugin_query_layout: '/plugin/query/layout',

  Plugin_subscription_renders: '/plugin/subscription/renders',

  Plugin_mutation_mutation: '/plugin/mutation/mutation',
  Plugin_fragment_update: '/plugin/fragment/update',

  Plugin_load_single: '/plugin/load/single',
  Plugin_load_loadAndGlobal: '/plugin/load/inlineAndGlobal',
  Plugin_load_list: '/plugin/load/list',
  Plugin_load_pageQuery: '/plugin/load/pageQuery',
  Plugin_load_pageQuerySession: '/plugin/load/pageQuery-session',

  Pagination_query_forward_cursor: '/pagination/query/forward-cursor',
  Pagination_query_backwards_cursor: '/pagination/query/backwards-cursor',
  Pagination_query_offset: '/pagination/query/offset',
  Pagination_query_offset_variable: '/pagination/query/offset-variable',

  Pagination_fragment_forward_cursor: '/pagination/fragment/forward-cursor',
  Pagination_fragment_backwards_cursor: '/pagination/fragment/backwards-cursor',
  Pagination_fragment_offset: '/pagination/fragment/offset',

  Stores_Nested_List: '/stores/nested-list',

  Stores_subunsub_list: '/stores/subunsub-list',
  Stores_subunsub_mutation: '/stores/subunsub-mutation',

  Stores_Layouts: '/layouts',
  Stores_Layouts_page2: '/layouts/page2'
};
