<script context="module">
	import { getQuery, graphql, setEnvironment, Environment } from 'houdini'

	export async function preload() {
		// load the data
		const data = await getQuery(graphql`
			query AllCharacters {
				characters {
					info {
						count
					}
				}
			}
		`) 

		return {
			data,
		}
	}

	// getFragment can be preprocessed into a reference to the appropriate store
	// to get updated values.

	// - getFragment(foo, user123) could just preprocess into a derived statement from the user store
	// - generated runtime can provide some kind of hook for a specific derived statement that is updated
	// whenever a mutation asks for values which intersect with the mutation
</script>

<script>
	export let data
</script>

<main>
	<p>
		{data.message}
	</p>
</main>
