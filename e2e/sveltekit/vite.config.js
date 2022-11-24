import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';
import { libReporter } from 'vite-plugin-lib-reporter';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    houdini(),
    sveltekit(),

    // This plugin is checking build sizes by lib.
    // It's not required for Houdini to work.
    libReporter([
      {
        name: 'houdini',
        includes: ['$houdini/runtime', 'houdini.config.js'],
        excludes: ['vite/preload-helper'],
        limit: {
          treeshaked: {
            compressed_max: 11.5
          }
        }
      },
      {
        name: 'houdini-svelte',
        includes: ['$houdini/plugins/houdini-svelte/runtime', 'src/lib/graphql/houdiniClient.ts'],
        excludes: ['vite/preload-helper', '$houdini/runtime', '$houdini/index.js', 'svelte'],
        limit: {
          treeshaked: {
            compressed_max: 8
          }
        }
      },
      {
        name: 'houdini-full-e2e',
        includes: ['$houdini', 'src/lib/graphql/houdiniClient.ts', 'houdini.config.js'],
        excludes: ['vite/preload-helper', 'svelte'],
        limit: {
          treeshaked: {
            compressed_max: 60
          }
        }
      }
    ])
  ]
};

export default config;
