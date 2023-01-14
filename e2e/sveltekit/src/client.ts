import { HoudiniClient } from '$houdini';

// Export the Houdini client
export default new HoudiniClient({
  url: 'http://localhost:4000/graphql',
  fetchParams({ session }) {
    return {
      headers: {
        Authorization: `Bearer ${session?.user?.token}` // session usage example
      }
    };
  }
});
