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

// to switch modes...
// 1/ TO REMOVE // this file with this variable 'persisted_queries_mode'
// 2/ TO DOCUMENT // TO FIND A NAME // e2e/kit/src/hooks.server.ts => handlePersistedQueries to add in kit mode. (anyway, will be called only on '/houdini/graphql')
// 3/ TO DOCUMENT // in full mode, e2e/_api/server.mjs usePersistedOperations plugin has to be uncommented
// 4/ TO DOCUMENT (pesistedd Query enabled in config) Don't forget to generate the operations.json file with pnpm houdini generate -o ./$houdini/persisted_queries.json
// All this to say that it's the begining, let's improve the dX now ;) from plugin add in sequence?

// How to remove "raw" from Artifacts?
// (maybe the best is to have a function getRow() looking into the arfitact.row or to the persisted_queries.json file to get the data)
// Nah! it's not important! Anyway the selection is present. So it's the same to have the raw or not.
// (recap this in github at some point)
// in artifact, what atout multiple export const instead of one export default? (like this, in presisted & with code split, raw will never be loaded?)
let persisted_queries_mode: 'clear' | 'kit' | 'full' = 'kit';

// Export the Houdini client
export default new HoudiniClient({
  // let's use the local kit url if we're in kit mode
  // @ts-ignore
  url: persisted_queries_mode === 'kit' ? '/houdini/graphql' : 'http://localhost:4000/graphql',
  fetchParams({ session, metadata }) {
    // if we're ever unauthenticated, a request was sent that didn't thread
    // the session through so let's error
    if (!session?.user?.token) {
      console.log(session);
      throw new Error('Did not encounter session');
    }

    return {
      headers: {
        Authorization: `Bearer ${session.user.token}`,
        ...(metadata?.allowNonPersistedQuery && { 'x-allow-arbitrary-operations': 'true' })
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
