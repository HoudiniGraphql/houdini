/** @type {import('houdini').ConfigFile} */
const config = {
  schemaPath: './api/*.graphql',
  sourceGlob: 'src/**/*.{svelte,gql,js,ts}',
  framework: 'kit',
  module: 'esm',
  apiUrl: 'http://localhost:4000/graphql',
  defaultCachePolicy: 'CacheOrNetwork',
  defaultPartial: true,
  routes: (filepath) => filepath && !filepath.includes('_') && !filepath.includes('+'),
  scalars: {
    DateTime: {
      type: 'Date',
      // turn the api's response into that type
      unmarshal(val) {
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
