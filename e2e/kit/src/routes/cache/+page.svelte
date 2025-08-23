<script lang="ts">
  import { cache, graphql } from '$houdini';

  // Query read without params
  cache.read({
    query: graphql(`
      query CacheQueryRead {
        usersList(snapshot: "Cache") {
          id
          name
        }
      }
    `)
  });

  // Query read with params
  cache.read({
    query: graphql(`
      query CacheQueryReadParams($userId: ID!) {
        user(id: $userId, snapshot: "Cache") {
          id
          name
          birthDate
        }
      }
    `),
    variables: {
      userId: '1'
    }
  });

  // Query write without params
  cache.write({
    query: graphql(`
      query CacheQueryWrite {
        user(id: 1, snapshot: "Cache") {
          name
        }
      }
    `),
    data: {
      user: { name: 'Harry' }
    }
  });

  // Query write with params
  cache.write({
    query: graphql(`
      query CacheQueryWriteParams($userId2: ID!) {
        user(id: $userId2, snapshot: "Cache") {
          name
        }
      }
    `),
    data: {
      user: {
        name: 'Harry'
      }
    },
    variables: {
      userId2: '1'
    }
  });

  // Fragment read without params
  cache.get('User', { id: '1' }).read({
    fragment: graphql(`
      fragment CacheFragmentRead on User {
        name
      }
    `)
  });

  // Fragment write without params
  cache.get('User', { id: '1' }).write({
    fragment: graphql(`
      fragment CacheFragmentWrite on User {
        name
      }
    `),
    data: {
      name: 'Harry'
    }
  });
</script>

<p>
  This route doesn't really do anything, it's just here to test the typings of
  <code>cache.read</code> and <code>cache.write</code>.
</p>
