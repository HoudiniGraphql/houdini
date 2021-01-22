<script context="module">
	import { getQuery, graphql } from 'houdini'

	export async function load() {
		// load the data
		const { data } = await getQuery(graphql`
			query AllCharacters {
				characters {
					info {
						count
					}
					result {
						name
						...CharacterAvatar_character
					}
				}
			}
		`)

		return { data, loading: false }
	}

	// getFragment can be preprocessed into a reference to the appropriate store
	// to get updated values.

	// - getFragment(foo, user123) could just preprocess into a derived statement from the user store
	// - generated runtime can provide some kind of hook for a specific derived statement that is updated
	// whenever a mutation asks for values which intersect with the mutation
</script>

<script>
	import CharacterAvatar from '../components/CharacterAvatar'

	export let data = { loading: true }
</script>

<main>
	<p>
		{#if data.loading}
			loading...
		{:else}
			There are {data.characters.info.count} characters in the API.
			<ul>
				{#each data.characters.result as character}
					<li>
						<CharacterAvatar {character} />
						{character.name}
					</li>
				{/each}
			</ul>
		{/if}
	</p>
</main>
