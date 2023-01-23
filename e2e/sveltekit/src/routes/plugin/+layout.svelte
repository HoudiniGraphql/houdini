<script>
  import { cache, graphql } from '$houdini';

  cache.get('User', { id: '1' }).write({
    fragment: graphql(`
      fragment UserUpdate on User {
        birthDate
      }
    `),
    data: {
      birthDate: new Date(),
      name: 'hello'
    }
  });
</script>

<slot />
