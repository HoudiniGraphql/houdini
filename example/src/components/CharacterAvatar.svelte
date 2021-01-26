<script>
	import { getFragment, graphql } from 'houdini'

	export let character

	// getFragment can be preprocessed into a reference to the appropriate store
	// to get updated values.

	// - getFragment(foo, user123) could just preprocess into a derived statement from the user store
	// - generated runtime can provide some kind of hook for a specific derived statement that is updated
	// whenever a mutation asks for values which intersect with the mutation
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
