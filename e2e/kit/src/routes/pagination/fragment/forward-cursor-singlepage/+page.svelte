<script lang="ts">
import { paginatedFragment, graphql } from '$houdini'
import type { PageData } from './$types'
import { stringify } from '$lib/utils/stringify'

export let data: PageData

$: ({ UserFragmentForwardsCursorSinglePageQuery: queryResult } = data)

$: fragmentResult = paginatedFragment(
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	$queryResult.data?.user ?? null,
	graphql(`
      fragment ForwardsCursorSinglePageFragment on User {
        usersConnectionSnapshot(snapshot: "pagination-fragment-forwards-cursor-singlepage-svelte", first: 2) @paginate(mode: SinglePage) {
          edges {
            node {
              name
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `)
)
</script>

<div id="result">
  {$fragmentResult.data?.usersConnectionSnapshot.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {stringify($fragmentResult.pageInfo)}
</div>

<button id="previous" on:click={() => fragmentResult.loadPreviousPage()}>previous</button>
<button id="next" on:click={() => fragmentResult.loadNextPage()}>next</button>
