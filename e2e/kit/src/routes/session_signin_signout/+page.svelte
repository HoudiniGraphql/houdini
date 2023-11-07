<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { cache, graphql } from '$houdini';

  export let form: FormData;

  const store = graphql(`
    query DemoSession @load {
      session
    }
  `);
</script>

<h1>Session & SignIn SignOut</h1>

<div id="form">
  {JSON.stringify(form)}
</div>

<div id="result">
  {$store.data?.session}
</div>

<hr />

<form
  method="POST"
  action="signin_signout?/sign_in"
  use:enhance={({}) => {
    return async ({ result }) => {
      if (result.type === 'success') {
        await invalidateAll();
        cache.reset();
        // goto('/');
      }
    };
  }}
>
  <input name="login" type="text" value="hello" required />
  <input name="password" type="password" value="pswd" required />
  <button>Sign In</button>
</form>

<form
  method="POST"
  action="signin_signout?/sign_out"
  use:enhance={({}) => {
    return async ({ result }) => {
      if (result.type === 'success') {
        await invalidateAll();
        cache.reset();
        // goto('/');
      }
    };
  }}
>
  <button>Sign Out</button>
</form>

<button id="get" on:click={() => store.fetch({ policy: 'NetworkOnly' })}>Get Session</button>
