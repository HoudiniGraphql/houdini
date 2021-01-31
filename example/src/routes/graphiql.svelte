<!-- 
	okay. i apologize in advanced for what you are about to read.
	i know its probably the ugliest thing you've seen in a svelte application, but 
	i spent a bunch of time trying to find a way to include a playground that 
	could execute an in-memory schema  that didn't rely on react but i  couldn't 
	figure out something that worked well.

	if you have an idea, PLEASE open a PR. 
-->
<script type="text/javascript">
	import { onMount } from 'svelte'
	import { graphql } from 'graphql'
	import schema from '../schema'

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
