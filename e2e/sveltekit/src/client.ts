import type { RequestHandler } from '$houdini';
import { HoudiniClient } from '$houdini';

// For Query & Mutation
const requestHandler: RequestHandler = async ({
  fetch,
  text = '',
  variables = {},
  metadata,
  session
}) => {
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
    console.info(JSON.stringify(json));
  }

  return json;
};

// Export the Houdini client
export default new HoudiniClient(requestHandler);
