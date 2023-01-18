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
    return {
      headers: {
        Authorization: `Bearer ${session?.user?.token}` // session usage example
      }
    };
  },
  throwOnError: {
    operations: ['all'],
    error: (errors) => error(500, errors.map((error) => error.message).join('. ') + '.')
  },
  plugins: [logMetadata]
});
