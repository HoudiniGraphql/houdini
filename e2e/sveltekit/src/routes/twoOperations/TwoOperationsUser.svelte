<script lang="ts">
  import { GQL_TwoOperationsUser } from '$houdini';

  export let id: string;
  const startColor = 'mt-2 flex flex-wrap text-red-500';
  const normalColor = 'mt-2 flex flex-wrap text-blue-500';
  $: color = startColor;

  export function TwoOperationsUserVariables({ props }: { props: { id: string } }) {
    return {
      id: props.id
    };
  }

  async function userPk() {
    color = startColor;
    await GQL_TwoOperationsUser.fetch({ variables: { id } });
    setTimeout(() => {
      color = normalColor;
    }, 1000);
  }
</script>

<button on:click={userPk}>userPk</button>
<br />

{#if $GQL_TwoOperationsUser?.data}
  <pre class={color}>G_userPk: {JSON.stringify($GQL_TwoOperationsUser?.data, null, 2)}</pre>
  <br />
{/if}
