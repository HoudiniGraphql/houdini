/// <references types="houdini-svelte">
/// <references types="houdini-plugin-svelte-global-stores">

/** @type {import('houdini').ConfigFile} */
const config = {
  schemaPath: '../_api/schema.graphql',
  defaultPartial: true,
  runtimeDir: '.houdini',
  // logLevel: 'Full',
  scalars: {
    DateTime: {
      type: 'Date',
      inputTypes: ['Int', 'String'],
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

  types: {
    RentedBook: {
      keys: ['userId', 'bookId']
    },
    UnionAorB: {
      keys: []
    }
  },

  plugins: {
    'houdini-svelte': {}
  }
};

export default config;
