import { HoudiniClient } from '$houdini';

// For Query & Mutation
// @ts-ignore
async function fetchQuery({ fetch, session, text = '', variables = {} }) {
  // @ts-ignore
  const result = await fetch('http://localhost:4000/graphql', {
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

  return await result.json();
}

// Export the Houdini client
export const houdiniClient = new HoudiniClient(fetchQuery);
// export const houdiniClient = new HoudiniClient(fetchQuery, socketClient)
