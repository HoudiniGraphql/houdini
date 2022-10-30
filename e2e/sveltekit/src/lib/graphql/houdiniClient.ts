import type { RequestHandlerArgs } from '$houdini';
import { HoudiniClient } from '$houdini';
import { stry } from '@kitql/helper';

// For Query & Mutation
async function fetchQuery({
  fetch,
  text = '',
  variables = {},
  metadata,
  session
}: RequestHandlerArgs) {
  // Prepare the request
  const url = 'http://localhost:4000/graphql';

  // regular fetch (Server & Client)
  const result = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.user?.token}` // session usage example
    },
    body: JSON.stringify({
      query: text,
      variables
    })
  });

  // return the result as a JSON object to Houdini
  const json = await result.json();

  // metadata usage example
  if (metadata?.logResult === true) {
    console.info(stry(json, 0));
  }

  return json;
}

// Export the Houdini client
export default new HoudiniClient(fetchQuery);
