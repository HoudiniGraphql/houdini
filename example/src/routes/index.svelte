<script context="module">
	import { getQuery, graphql } from 'houdini'

	export async function preload() {
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
