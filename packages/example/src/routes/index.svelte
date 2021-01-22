<script>
	import { getQuery, graphql, setEnvironment, Environment } from 'houdini'

	// configure the network layer for the application
	setEnvironment(
		new Environment(async function ({ text, variables }) {
			// send the request to the ricky and morty api
			const result = await fetch('https://rickandmortyapi.com/graphql', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					query: text,
					variables,
				}),
			})

			// parse the result as json
			return await result.json()
		})
	)

	// can this be compiled away to something that just sends the request?
	const query = getQuery(graphql`
		query AllCharacters {
			characters {
				info {
					count
				}
			}
		}
	`)

	// getFragment can be preprocessed into a reference to the appropriate store
	// to get updated values.

	// - getFragment(foo, user123) could just preprocess into a derived statement from the user store
	// - generated runtime can provide some kind of hook for a specific derived statement that is updated
	// whenever a mutation asks for values which intersect with the mutation
</script>

<main>
	<p>
		{#await $query}
			loading...
		{:then data}
			{(console.log(data), '')}
			There are characters in Rick and Morty!
		{:catch error}
			error! {error.message}
		{/await}
	</p>
</main>
