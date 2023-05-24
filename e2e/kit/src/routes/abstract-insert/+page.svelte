<script lang="ts">
  import { graphql } from '$houdini';

  $: store = graphql(`
    query AbstractInsert_AnimalsList @load {
      animals @list(name: "AbstractAnimalsList") {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `);

  const addMonkeyMutation = graphql(`
    mutation AddMonkey($name: String!) {
      addMonkey(name: $name) {
        ...AbstractAnimalsList_insert
      }
    }
  `);

  const deleteMonkeyMutation = graphql(`
    mutation DeleteMonkey($id: ID!) {
      deleteMonkey(monkeyId: $id) {
        id
        name
      }
    }
  `);

  let newMonkeyName = '';

  const createMonkey = () => {
    addMonkeyMutation.mutate({ name: newMonkeyName });
  };

  const deleteMonkey = (id: string) => {
    deleteMonkeyMutation.mutate({ id });
  };
</script>

<div style="display:flex; flex-gap: 2rem;">
  <input type="text" bind:value={newMonkeyName} />
  <button on:click={createMonkey}>Create monkey</button>
</div>

{#if $store.data}
  <ul>
    {#each $store.data.animals.edges as animalEdge}
      {#if animalEdge.node}
        <li>
          {animalEdge.node.id} - {animalEdge.node.name}
          <button style="margin-left: .5rem;" on:click={() => deleteMonkey(animalEdge.node?.id ?? "")}>Delete</button>
        </li>
      {/if}
    {/each}
  </ul>
{/if}
