/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
  schemaPath: '../_api/*.graphql',
  defaultCachePolicy: 'CacheOrNetwork',
  defaultPartial: true,
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
    },
    File: {
      type: 'File'
    }
  },
  plugins: {
    'houdini-svelte': {
      client: './src/lib/graphql/houdiniClient'
    }
  }
};

export default config;
