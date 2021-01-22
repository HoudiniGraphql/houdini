<script>
	import { getFragment, graphql } from 'houdini'

	export let character

	const data = getFragment(
		graphql`
			fragment CharacterAvatar_character on Character {
				name
				image
			}
		`,
		character
	)
</script>

<img src={data.image} height="300px" width="300px" alt={`${data.name}`} />
