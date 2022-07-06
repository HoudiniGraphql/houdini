/** @type {import('houdini').ConfigFile} */
const config = {
  schemaPath: './api/*.graphql',
  sourceGlob: 'src/**/*.{svelte,gql}',
  framework: 'kit',
  module: 'esm',
  apiUrl: 'http://localhost:4000/graphql',
  defaultCachePolicy: 'CacheOrNetwork',
  routes: (filepath) => filepath && !filepath.includes('_') && !filepath.includes('+'),
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
