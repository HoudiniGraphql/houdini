import { HoudiniClient, type ClientPlugin } from '$houdini';
import { createClient } from 'graphql-ws';
import { error } from '@sveltejs/kit';
import { subscription } from '$houdini/plugins';

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
  fetchParams({ session, hash, variables }) {
    // if we're ever unauthenticated, a request was sent that didn't thread
    // the session through so let's error
    if (!session?.user?.token) {
      console.log(session);
      throw new Error('Did not encounter session');
    }

    // Turn on and off (to link with 'with_persisted_queries' of "houdini/e2e/_api/server.mjs")
    let with_persisted_queries = false;
    if (with_persisted_queries) {
      return {
        headers: {
          Authorization: `Bearer ${session.user.token}`
        },
        body: JSON.stringify({
          doc_id: hash,
          variables: variables
        })
      };
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
  plugins: [
    logMetadata,
    subscription(() =>
      createClient({
        url: 'ws://localhost:4000/graphql'
      })
    )
  ]
});
