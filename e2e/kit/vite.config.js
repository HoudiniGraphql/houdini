import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';
import { kitRoutes } from 'vite-plugin-kit-routes';
import { libReporter } from 'vite-plugin-lib-reporter';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    houdini(),
    sveltekit(),
    kitRoutes({
      extend: {
        PAGES: {
          nested_routes_user_userId_birth: { params: { userId: { default: 1 } } },
          nested_routes_user_userId_friends: { params: { userId: { default: 1 } } },
          plugin_query_infer_input_custom_function_snapshot_id: {
            params: { snapshot: { default: 'snapshot' }, id: { default: 1 } }
          },
          plugin_query_infer_input_user_snapshot_id: {
            params: { snapshot: { default: 'snapshot' }, id: { default: 1 } }
          },
          plugin_query_variable_id_integer: { params: { id: { default: 1 } } },
          stores_partial_partial_userId: { params: { userId: { default: 1 } } },
          stores_partial_partial_userId_Light: { params: { userId: { default: 1 } } },
          stores_prefetch_userId: { params: { userId: { default: 1 } } },
          stores_ssr_userId: { params: { userId: { default: 1 } } },
          subscriptions_snapshot: { params: { snapshot: { default: 'snapshot' } } }
        }
      }
    }),

    // This plugin is checking build sizes by lib.
    // It's not required for Houdini to work.
    // If there is a config change needed, please comment it and let us know.
    libReporter([
      {
        name: 'houdini runtime core',
        includes: ['$houdini/runtime'],
        excludes: [
          '$houdini/index.js',
          '$houdini/plugins/index.js',
          'houdini.config.js',
          'graphql-ws',
          'svelte'
        ]
      },
      {
        name: 'houdini runtime svelte',
        includes: ['$houdini/plugins/houdini-svelte/runtime', 'src/client.ts'],
        excludes: [
          '$houdini/runtime',
          '$houdini/index.js',
          '$houdini/plugins/index.js',
          'graphql-ws',
          'vite/preload-helper',
          'svelte'
        ]
      },
      {
        name: 'houdini full e2e',
        includes: ['$houdini', 'src/client.ts', 'houdini.config.js'],
        excludes: ['graphql-ws', 'vite/preload-helper', 'svelte']
      }
    ])
  ]
};

export default config;
