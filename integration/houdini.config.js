/** @type {import('houdini').ConfigFile} */
const config = {
  schemaPath: './api/*.graphql',
  sourceGlob: 'src/**/*.{svelte,gql}',
  framework: 'kit',
  module: 'esm',
  apiUrl: 'http://localhost:4000/graphql',
  defaultCachePolicy: 'CacheOrNetwork',
  defaultPartial: true,
  scalars: {
    DateTime: {
      type: 'Date',
      // turn the api's response into that type
      unmarshal(val) {
        if (val === null) {
          return null;
        }
        return new Date(val);
      },
      // turn the value into something the API can use
      marshal(val) {
        return val.getTime();
      }
    }
  }
};

export default config;
