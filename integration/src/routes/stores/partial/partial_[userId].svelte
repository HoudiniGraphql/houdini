<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { GQL_Partial_User, type Partial_User$input } from '$houdini';
  import type { Load } from './__types/partial_[userId]';

  export const load: Load<{}, { variables: Partial_User$input }> = async (event) => {
    const variables = { id: event.params.userId };

    await GQL_Partial_User.fetch({ event, variables });

    return {
      props: {
        variables
      }
    };
  };
</script>

<script lang="ts">
  export let variables: Partial_User$input;

  $: browser && GQL_Partial_User.fetch({ variables });
</script>

<a href="./partial_List">Back to the list</a>

<br />
<br />

<div id="id">
  {$GQL_Partial_User.data?.user.id}
</div>
<div id="name">
  {$GQL_Partial_User.data?.user.name}
</div>
<div id="birthDate">
  {$GQL_Partial_User.data?.user.birthDate?.toISOString()}
</div>
