<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { GQL_Partial_User_Light, type Partial_User$input } from '$houdini';
  import type { Load } from '@sveltejs/kit';

  export const load: Load<{ userId: string }, {}, { variables: Partial_User$input }> = async (
    event
  ) => {
    const variables = { id: event.params.userId };

    await GQL_Partial_User_Light.fetch({ event, variables });

    return {
      props: {
        variables
      }
    };
  };
</script>

<script lang="ts">
  export let variables: Partial_User$input;

  $: browser && GQL_Partial_User_Light.fetch({ variables });
</script>

<a href="./partial_List">Back to the list</a>

<br />
<br />

<div id="id">
  {$GQL_Partial_User_Light.data?.user.id}
</div>
<div id="name">
  {$GQL_Partial_User_Light.data?.user.name}
</div>
