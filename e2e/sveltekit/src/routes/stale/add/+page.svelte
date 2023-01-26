<script>
  import { cache, graphql } from '$houdini';

  const addUser = graphql(`
    mutation AddUserNode_FeatStale {
      addUser(name: "New User", birthDate: 531747620000, snapshot: "UserNodes_FeatStale") {
        id
      }
    }
  `);

  const markStale_everything = async () => {
    await addUser.mutate(null);
    cache.markStale();
  };

  const markStale_type = async () => {
    await addUser.mutate(null);
    cache.markStale('UserNodes');
  };

  const markStale_type_field = async () => {
    await addUser.mutate(null);
    cache.markStale('UserNodes', { field: 'totalCount' });
  };

  const markStale_subtype = async () => {
    await addUser.mutate(null);
    cache.markStale('User');
  };

  const markStale_entry = async () => {
    await addUser.mutate(null);
    const user = cache.get('User', { id: '1' });
    user.markStale();
  };

  const markStale_entry_field = async () => {
    await addUser.mutate(null);
    const user = cache.get('User', { id: '1' });
    user.markStale('name');
  };

  const markStale_entry_field_when = async () => {
    await addUser.mutate(null);
    const user = cache.get('User', { id: '1' });
    user.markStale('name', args: { name: 'New User' } );
  };
</script>

<br />
<button on:click={markStale_everything}>markStale_everything</button>
<br />
<button on:click={markStale_type}>markStale_type</button>
<br />
<button on:click={markStale_type_field}>markStale_type_field</button>
<br />
<button on:click={markStale_subtype}>markStale_subtype</button>
<br />
<button on:click={markStale_entry}>markStale_entry</button>
<br />
<button on:click={markStale_entry_field}>markStale_entry_field</button>
<br />
<button on:click={markStale_entry_field_when}>markStale_entry_field_when</button>
<br />
