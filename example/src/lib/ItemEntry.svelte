<script>
	import { graphql, fragment } from '$houdini'

	// the reference we're passed from our parents
	export let item

	// get the information we need about the item
	const data = fragment(
		graphql`
			fragment ItemEntry_item on TodoItem {
				id
				text
				completed
				createdAt
			}
		`,
		item
	)

	// create the functions we'll invoke to check, uncheck, and delete the item
	const completeItem = graphql`
		mutation CompleteItem($id: ID!) {
			checkItem(item: $id) {
				item {
					id
					completed
					...Filtered_Items_remove @when(completed: false)
				}
			}
		}
	`
	const uncompleteItem = graphql`
		mutation UncompleteItem($id: ID!) {
			uncheckItem(item: $id) {
				item {
					id
					completed
					...Filtered_Items_remove @when(completed: true)
				}
			}
		}
	`
	const deleteItem = graphql`
		mutation DeleteItem($id: ID!) {
			deleteItem(item: $id) {
				itemID @TodoItem_delete
			}
		}
	`

	// make sure the todo items stay up to date
	const itemUpdates = graphql`
		subscription ItemUpdate($id: ID!) {
			itemUpdate(id: $id) {
				item {
					id
					completed
					text
					createdAt
				}
			}
		}
	`
	$: itemUpdates.listen({ id: $data.id })

	async function handleClick() {
		// if the item is already checked
		if ($data.completed) {
			// uncheck it
			await uncompleteItem.mutate({ id: $data.id })
		}
		// the item is unchecked
		else {
			// check it
			await completeItem.mutate({ id: $data.id })
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
		<label for={$data.text} class="row">
			{$data.text}
			<span class="timestamp">
				{$data.createdAt.toLocaleDateString('en-US')}
			</span>
		</label>
		<button class="destroy" on:click={() => deleteItem.mutate({ id: $data.id })} />
	</div>
</li>

<style>
	.timestamp {
		font-size: 14px;
		margin-top: 4px;
		margin-right: 50px;
	}

	.destroy,
	input {
		cursor: pointer;
	}

	.row {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}
</style>
