export function AllItemsVariables({ params }) {
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
