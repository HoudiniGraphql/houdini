<script>
  import { enhance } from '$app/forms';

  /** @type {import('./$types').ActionData} */
  export let form;
</script>

<form method="POST" action="?/add" use:enhance>
  <label>
    Name
    <input name="name" type="name" />
  </label>
  <span id="name-error"
    >{#if form?.name}{form?.name}{/if}</span
  >
  <button type="submit">Add</button>
</form>

<div id="result">
  {form?.data?.addUser?.name || 'No user added'}
</div>
