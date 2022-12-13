import { graphql } from '$houdini'

export const _houdini_load = graphql`
	query AllItems($completed: Boolean) @cache(policy: CacheOrNetwork) {
		filteredItems: items(completed: $completed, first: 2) @paginate(name: "Filtered_Items") {
			edges {
				node {
					id
					completed
					...ItemEntry_item
				}
			}
		}
		allItems: items @list(name: "All_Items") {
			edges {
				node {
					id
					completed
				}
			}
		}
	}
`

export function _AllItemsVariables({ params }) {
	// if there is no filter assigned, dont enforce one in the query
	if (!params.filter || params.filter === 'all') {
		return {
			completed: undefined,
		}
	}

	// make sure we recognize the value
	if (!['active', 'completed', 'all'].includes(params.filter)) {
		return this.error(400, "filter must be one of 'active' or 'completed'")
	}

	return {
		completed: params.filter === 'completed',
	}
}
