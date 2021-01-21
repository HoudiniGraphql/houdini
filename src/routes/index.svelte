<script>
	import { getQuery, graphql } from '$houdini'

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
			There are {data.characters.info.count} characters in Rick and Morty!
		{:catch error}
			error! {error.message}
		{/await}
	</p>
</main>
