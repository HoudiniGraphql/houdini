<script>
	import { graphql } from '$houdini';

	const store = graphql(`
		query ExampleQuery @live {
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
</script>

{#if $store.fetching}
	loading...
{:else}
	{#each $store.data?.todoList?.todos?.edges ?? [] as todo}
		<div>
			{todo?.node.id}
		</div>
	{/each}
{/if}
