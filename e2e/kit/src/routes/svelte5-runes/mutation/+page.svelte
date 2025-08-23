<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini';

  interface Props {
    data: PageData;
  }
  const { data }: Props = $props();
  const { Svelte5MutationGetData } = $derived(data);

  const changeNameMutation = graphql(`
    mutation Svelte5MutationChangeName($name: String!) {
      updateUser(id: "1", name: $name, snapshot: "svelte-5-mutation") {
        id
        name
      }
    }
  `);

  const changeName = () => {
    changeNameMutation.mutate({
      name: 'Seppe'
    });
  };
</script>

<div id="result">{$Svelte5MutationGetData.data?.user.name}</div>

<button id="mutate" onclick={changeName}>rename</button>
