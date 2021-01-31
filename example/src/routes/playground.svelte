<script type="text/javascript">
	import { onMount } from 'svelte'
	import { graphql } from 'graphql'
	import schema from '../schema'

	// mount
	onMount(() => {
		ReactDOM.render(
			React.createElement(GraphiQL, {
				fetcher: ({ query, variables }) => {
					return graphql(schema, query, null, null, variables)
				},
			}),
			document.getElementById('graphiql')
		)
	})
</script>

<svelte:head
	><script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script><script
		crossorigin
		src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script><script
		crossorigin
		src="https://unpkg.com/graphiql/graphiql.min.js"></script><link
		href="https://unpkg.com/graphiql/graphiql.min.css"
		rel="stylesheet"
	/></svelte:head
>

<div id="graphiql" style="height: 100vh;" />
