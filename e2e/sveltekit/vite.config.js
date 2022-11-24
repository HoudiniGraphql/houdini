import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';
import { libReporter } from 'vite-plugin-lib-reporter';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    houdini(),
    sveltekit(),
    libReporter({
      name: 'houdini',
      includes: ['$houdini/runtime', 'houdini.config.js'],
      excludes: ['vite/preload-helper'],
      limit: {
        source: {
          nb_file_max: 19 // Just to make sure we don't add a file by mistake
        },
        treeshaked: {
          compressed_max: 11.5
        }
      }
    }),
    libReporter({
      name: 'houdini-svelte',
      includes: ['$houdini/plugins/houdini-svelte/runtime', 'src/lib/graphql/houdiniClient.ts'],
      excludes: ['vite/preload-helper', '$houdini/runtime', '$houdini/index.js', 'svelte'],
      limit: {
        source: {
          nb_file_max: 18 // Just to make sure we don't add a file by mistake
        },
        treeshaked: {
          compressed_max: 8
        }
      }
    }),
    libReporter({
      name: 'houdini-full-e2e',
      includes: ['$houdini', 'src/lib/graphql/houdiniClient.ts', 'houdini.config.js'],
      excludes: ['vite/preload-helper', 'svelte'],
      limit: {
        treeshaked: {
          compressed_max: 60 // Growing with the number of stores & co. We want to increase it manually
        }
      }
    })
  ]
};

export default config;
