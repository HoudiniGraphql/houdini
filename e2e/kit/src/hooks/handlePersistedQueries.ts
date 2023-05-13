import type { Handle } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { path } from 'houdini';

export type PersistedQueriesOptions = {
  /**
   * your real endpoint url
   */
  endpointUrl: string;

  /**
   * the local url of SvelteKit. You will need to set the same url in your HoudiniClient. (default: `/houdini/graphql`)
   */
  localUrl?: string;

  /**
   * Path of the file holding all operations  (default: `./$houdini/persisted_queries.json`)
   */
  operationsPath?: string;
};

/**
 * Usage:
 *
 * import { sequence } from '@sveltejs/kit/hooks';
 * import { handlePersistedQueries } from '$houdini';
 *
 * export const handle = sequence(
 *   handlePersistedQueries({
 *     endpointUrl: 'http://localhost:4000/graphql'
 *   })
 * );
 *
 */
export const handlePersistedQueries = (options: PersistedQueriesOptions): Handle => {
  const { localUrl, operationsPath } = {
    localUrl: '/houdini/graphql',
    operationsPath: './$houdini/persisted_queries.json',
    ...options
  };

  const operationsFilePath = path.join(operationsPath);
  const store = JSON.parse(readFileSync(operationsFilePath, 'utf-8')!);

  return async ({ event, resolve }) => {
    if (event.url.pathname === localUrl) {
      // bypass the handler if the request is allowed to be arbitrary
      if (event.request.headers.get('x-allow-arbitrary-operations') === 'true') {
        return event.fetch(new Request(options.endpointUrl, event.request)).catch((err) => {
          console.log('handlePersistedQueries ERROR', err);
          throw err;
        });
      }

      // get the hash data
      const bodyJson = await event.request.json();

      // retrive the operation from the store
      const body = JSON.stringify({
        query: store[bodyJson.doc_id],
        variables: bodyJson.variables
      });

      // update the content length
      event.request.headers.set('content-length', body.length.toString());

      return event
        .fetch(
          new Request(options.endpointUrl, {
            body: JSON.stringify({
              query: store[bodyJson.doc_id],
              variables: bodyJson.variables
            }),
            method: event.request.method,
            headers: event.request.headers,
            // @ts-ignore
            duplex: 'half'
          })
        )
        .catch((err) => {
          console.log('handlePersistedQueries ERROR', err);
          throw err;
        });
    }

    // Fallback to normal request
    return resolve(event);
  };
};
