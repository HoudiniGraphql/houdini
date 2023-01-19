<script>
  import { cache, graphql } from '$houdini';

  const addUser = graphql(`
    mutation AddUserNode_FeatStale {
      addUser(name: "New User", birthDate: 531747620000, snapshot: "UserNodes_FeatStale") {
        id
      }
    }
  `);

  // Option 1
  const add_all_list_stale = async () => {
    await addUser.mutate(null);
    cache.markStale('UserNodes');
  };

  // Option 2
  const add_node_stale = async () => {
    await addUser.mutate(null);
    cache.markStale('User');
  };

  // Option 3
  const add_totalCount = async () => {
    await addUser.mutate(null);
    // const userNodes = cache.get('UserNodes'); // data => never. How to do like all?
    // userNodes.markStale({ field: 'totalCount' });
  };
</script>

<br />
<button on:click={add_all_list_stale}>add_all_list_stale</button>
<br />
<button on:click={add_node_stale}>add_node_stale</button>
<br />
<button on:click={add_totalCount}>add_totalCount</button>
