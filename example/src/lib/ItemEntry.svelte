<script lang="ts">
	import {
		fragment,
		mutation,
		graphql,
		subscription,
		ItemEntry_item,
		CompleteItem,
		UncompleteItem,
		DeleteItem
	} from '$houdini'

	// the reference we're passed from our parents
	export let item: ItemEntry_item

	// get the information we need about the item
	const data = fragment(
		graphql`
			fragment ItemEntry_item on TodoItem @arguments(filter: { type: "String!" }) {
				id
				text
				completed
				createdAt
				filter(val: $filter)
			}
		`,
		item
	)

	// create the functions we'll invoke to check, uncheck, and delete the item
	const completeItem = mutation<CompleteItem>(graphql`
		mutation CompleteItem($id: ID!) {
			checkItem(item: $id) {
				item {
					id
					completed
					...Filtered_Items_remove @when(completed: false)
				}
			}
		}
	`)
	const uncompleteItem = mutation<UncompleteItem>(graphql`
		mutation UncompleteItem($id: ID!) {
			uncheckItem(item: $id) {
				item {
					id
					completed
					...Filtered_Items_remove @when(completed: true)
				}
			}
		}
	`)
	const deleteItem = mutation<DeleteItem>(graphql`
		mutation DeleteItem($id: ID!) {
			deleteItem(item: $id) {
				itemID @TodoItem_delete
			}
		}
	`)

	// make sure the todo items stay up to date
	subscription(
		graphql`
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
		`,
		{
			id: $data.id
		}
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

<style>
	.timestamp { 
		font-size: 14px;
		margin-top: 4px;
		margin-right: 50px;
	}

	.destroy, input {
		cursor: pointer;
	}

	.row {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}
</style>

<li class:completed={$data.completed}>
	<div class="view" >
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
				{$data.createdAt.toLocaleDateString("en-US")}
			</span> - { $data.filter}
		</label>
		<button class="destroy" on:click={() => deleteItem({ id: $data.id })} />
	</div>
</li>
