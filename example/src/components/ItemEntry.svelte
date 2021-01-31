<script>
	import { getFragment, graphql } from 'houdini'

	export let item

	// getFragment can be preprocessed into a reference to the appropriate store
	// to get updated values.

	// - getFragment(foo, user123) could just preprocess into a derived statement from the user store
	// - generated runtime can provide some kind of hook for a specific derived statement that is updated
	// whenever a mutation asks for values which intersect with the mutation
	const data = getFragment(
		graphql`
			fragment ItemEntry_item on TodoItem {
				text
				completed
			}
		`,
		item
	)
</script>

<li class:completed={data.completed}>
	<div class="view">
		<input name={data.text} class="toggle" type="checkbox" checked={data.completed} />
		<label for={data.text}>{data.text}</label>
		<button class="destroy" />
	</div>
</li>
