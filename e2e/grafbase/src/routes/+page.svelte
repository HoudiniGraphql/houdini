<script>
	import { graphql } from '$houdini';

	$: store = graphql(`
		query ExampleQuery @live @load {
			todoList(by: { id: "todolist_01GNR11QB5ENGHMG0Y3PH98ZHF" }) {
				todos(first: 10) {
					edges {
						node {
							id
							title
						}
					}
				}
			}
		}
	`);

	$: console.log($store);
</script>

{#if $store.fetching}
	loading...
{:else if $store.errors?.length}
	{JSON.stringify($store.errors)}
{:else}
	{#each $store.data?.todoList?.todos?.edges ?? [] as todo}
		<div>
			{todo?.node.id}
		</div>
	{/each}
{/if}
