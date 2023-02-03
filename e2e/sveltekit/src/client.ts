import { HoudiniClient, type ClientPlugin } from '$houdini';
import { error } from '@sveltejs/kit';

// in order to verify that we send metadata, we need something that will log the metadata after
const logMetadata: ClientPlugin = () => ({
  end(ctx, { resolve, value }) {
    if (ctx.metadata?.logResult === true) {
      console.info(JSON.stringify(value));
    }

    resolve(ctx);
  }
});

// Export the Houdini client
export default new HoudiniClient({
  url: 'http://localhost:4000/graphql',
  fetchParams({ session }) {
    // if we're ever unauthenticated, a request was sent that didn't thread
    // the session through so let's error
    if (!session?.user?.token) {
      console.log(session);
      throw new Error('Did not encounter session');
    }

    return {
      headers: {
        Authorization: `Bearer ${session.user.token}`
      }
    };
  },
  throwOnError: {
    operations: ['all'],
    error: (errors) => error(500, errors.map((error) => error.message).join('. ') + '.')
  },
  plugins: [logMetadata]
});
