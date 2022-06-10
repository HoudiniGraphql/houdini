/** @type {import('houdini').ConfigFile} */
const config = {
  schemaPath: './api/*.graphql',
  sourceGlob: 'src/**/*.{svelte,gql}',
  framework: 'kit',
  module: 'esm',
  apiUrl: 'http://localhost:4000/graphql',
  defaultCachePolicy: 'CacheOrNetwork',
  scalars: {
    DateTime: {
      type: 'Date',
      marshal(val) {
        return val.getTime();
      },
      unmarshal(val) {
        return new Date(val);
      }
    }
  }
};

export default config;
