<script>
  import { cache, graphql } from '$houdini';
  const addUser = graphql(`
    mutation AddUserNode_FeatStale {
      addUser(name: "New User", birthDate: 531747620000, snapshot: "UserNodes_FeatStale") {
        id
      }
    }
  `);
  const add = async () => {
    await addUser.mutate(null);
    // Option 1 => Work well

    // cache.markStale('UserNodes');
    // Option 2 => Work well
    cache.markStale('User');
    // totalCount => Doesn"t work
    // const tmp = cache.get('UserNodes'); // data => never. How to do like all?
    // tmp.markStale({ field: 'totalCount' });
  };
</script>

<button on:click={add}>Add User</button>
