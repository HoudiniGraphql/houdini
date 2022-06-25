import { HoudiniClient, type RequestHandlerArgs } from '$houdini';
import { stry } from '@kitql/helper';

// For Query & Mutation
async function fetchQuery({ fetch, text = '', variables = {}, session, metadata }: RequestHandlerArgs) {
  // // You can do what you want with your session
  // console.log(`session`, session);

  // // You can do what you want with your metadata at query/mutation level
  // console.log(`metadata`, metadata);

  const url = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'
  const result = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.token}`
    },
    body: JSON.stringify({
      query: text,
      variables
    })
  });

  const json = await result.json();

  if (metadata?.logResult === true) {
    console.info(stry(json, 0));
  }

  // return the result as a JSON object to Houdini
  return json;
}

// Export the Houdini client
export const houdiniClient = new HoudiniClient(fetchQuery);
// export const houdiniClient = new HoudiniClient(fetchQuery, socketClient)
