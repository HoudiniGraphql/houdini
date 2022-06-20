import { HoudiniClient } from '$houdini';

// For Query & Mutation
async function fetchQuery({ text = '', variables = {} }, session: App.Session) {
  //  eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const result = await this.fetch('http://localhost:4000/graphql', {
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
