export const routes = {
  Home: '/',
  GraphQL: 'http://localhost:4000/graphql',

  // edge cases

  union_result: '/union-result',
  customIDs: '/customIDs',
  subscriptions_happyPath: '/subscriptions/happyPath',
  subscriptions_two_subscriptions: '/subscriptions/two',
  abstractFragments: '/abstract-fragments',
  abstractFragments_nestedConnection: '/abstract-fragments/nested-connection',
  fragment_masking_partial: '/fragment-masking-partial',
  loading_state: '/loading-state',
  required_field: '/required-field',

  Lists_fragment: '/lists/fragment',
  Lists_mutation_insert: '/lists/mutation-insert',

  Stores_SSR: '/stores/ssr',
  Stores_Network: '/stores/network',
  Stores_SSR_UserId_2: '/stores/ssr-2',
  Stores_Prefetch_UserId_2: '/stores/prefetch-2',
  Stores_Mutation: '/stores/mutation',
  Stores_Mutation_Opti_List: '/stores/mutation-opti-list',
  Stores_Mutation_Update: '/stores/mutation-update',
  Stores_Mutation_Scalars: '/stores/mutation-scalars',
  Stores_Mutation_Scalar_Single_Upload: '/stores/mutation-scalar-single-upload',
  Stores_Mutation_Scalar_Multi_Upload: '/stores/mutation-scalar-multi-upload',
  Stores_Mutation_Enums: '/stores/mutation-enums',
  Stores_Network_One_Store_Multivariables: '/stores/network-one-store-multivariables',
  Stores_SSR_LoadAll_Store_Without_Variables: '/stores/ssr-loadall-store-without-variables',
  Stores_SSR_One_Store_Multivariables: '/stores/ssr-one-store-multivariables',
  Stores_Fragment_Null: '/stores/fragment-null',
  Stores_Metadata: '/stores/metadata',
  Stores_action_mutation: '/stores/action-mutation',
  Stores_Endpoint_Query: '/stores/endpoint-query',
  Stores_Session: '/stores/session',
  Stores_Comp_disable_auto_fetch: '/stores/comp_disable_auto_fetch',

  Stores_Partial_List: '/stores/partial/partial_List',
  Stores_Partial_Off: '/stores/partial-off',
  Stores_Partial_Off_Child: '/stores/partial-off/child',
  Stores_Connection_Fragment: '/stores/connection-fragment',
  Stores_Directives: '/stores/directives',

  union_insert: '/union-insert',

  Plugin_query_scalars: '/plugin/query/scalars',
  Plugin_query_layout: '/plugin/query/layout',

  Plugin_subscription_renders: '/plugin/subscription/renders',

  Plugin_fragment_update: '/plugin/fragment/update',

  Pagination_query_forward_cursor: '/pagination/query/forward-cursor',
  Pagination_query_backwards_cursor: '/pagination/query/backwards-cursor',
  Pagination_query_bidirectional_cursor: '/pagination/query/bidirectional-cursor',
  Pagination_query_bidirectional_cursor_single_page:
    '/pagination/query/bidirectional-cursor-single-page',
  Pagination_query_offset: '/pagination/query/offset',
  Pagination_query_offset_single_page: '/pagination/query/offset-single-page',
  Pagination_query_offset_variable: '/pagination/query/offset-variable',

  Pagination_fragment_forward_cursor: '/pagination/fragment/forward-cursor',
  Pagination_fragment_backwards_cursor: '/pagination/fragment/backwards-cursor',
  Pagination_fragment_bidirectional_cursor: '/pagination/fragment/bidirectional-cursor',
  Pagination_fragment_offset: '/pagination/fragment/offset',
  Pagination_fragment_required_arguments: '/pagination/fragment/required-arguments',

  nested_argument_fragments: '/nested-argument-fragments',
  nested_argument_fragments_masking: '/nested-argument-fragments-masking',

  Stores_Nested_List: '/stores/nested-list',

  Stores_subunsub_list: '/stores/subunsub-list',
  Stores_subunsub_mutation: '/stores/subunsub-mutation',

  Stores_Layouts: '/layouts',
  Stores_Layouts_page2: '/layouts/page2',

  Svelte5_Runes_Simple_SSR: '/svelte5-runes/simple-ssr',
  Svelte5_Runes_Pagination: '/svelte5-runes/pagination',
  Svelte5_Runes_Fragment: '/svelte5-runes/fragment',
  Svelte5_Runes_Mutation: '/svelte5-runes/mutation'
};
