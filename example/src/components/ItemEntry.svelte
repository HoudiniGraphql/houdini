<script>
	import { fragment, mutation, graphql } from 'houdini'

	// the reference we're passed from our parents
	export let item

	// get the information we need about the item
	const data = fragment(
		graphql`
			fragment ItemEntry_item on TodoItem {
				id
				text
				completed
			}
		`,
		item
	)

	// create a callbacks we'll invoke to check and uncheck thie item
	const completeItem = mutation(graphql`
		mutation CompleteItem($id: ID!) {
			completeItem(id: $id) {
				item {
					id
					completed
				}
			}
		}
	`)
	const uncompleteItem = mutation(graphql`
		mutation UncompleteItem($id: ID!) {
			uncompleteItem(id: $id) {
				item {
					id
					completed
				}
			}
		}
	`)

	async function handleClick(input) {
		// if the item is already checked
		if ($data.completed) {
			// uncheck it
			await uncompleteItem({ id: $data.id })
		}
		// the item is unchecked
		else {
			// check it
			await completeItem({ id: $data.id })
		}
	}
</script>

<li class:completed={$data.completed}>
	<div class="view">
		<input
			name={$data.text}
			class="toggle"
			type="checkbox"
			checked={$data.completed}
			on:click={handleClick}
		/>
		<label for={$data.text}>{$data.text}</label>
		<button class="destroy" />
	</div>
</li>
