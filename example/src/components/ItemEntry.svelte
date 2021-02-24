<script lang="ts">
	import { fragment, mutation, graphql } from 'houdini'
	import type { ItemEntry_item, CompleteItem, UncompleteItem, DeleteItem } from '../../generated'
	import { stores } from '@sapper/app'

	// the reference we're passed from our parents
	export let item: ItemEntry_item

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
	const completeItem = mutation<CompleteItem>(
		graphql`
			mutation CompleteItem($id: ID!) {
				checkItem(item: $id) {
					item {
						id
						completed
						...All_Items_remove @when(argument: "completed", value: "false")
					}
				}
			}
		`
	)

	const uncompleteItem = mutation<UncompleteItem>(
		graphql`
			mutation UncompleteItem($id: ID!) {
				uncheckItem(item: $id) {
					item {
						id
						completed
						...All_Items_remove @when(argument: "completed", value: "true")
					}
				}
			}
		`
	)

	const deleteItem = mutation<DeleteItem>(
		graphql`
			mutation DeleteItem($id: ID!) {
				deleteItem(item: $id) {
					itemID @TodoItem_delete
				}
			}
		`
	)

	async function handleClick() {
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
		<button class="destroy" on:click={() => deleteItem({ id: $data.id })} />
	</div>
</li>
