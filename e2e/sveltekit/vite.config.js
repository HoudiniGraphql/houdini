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
    // If there is a config change needed, please comment it and let us know.
    libReporter([
      {
        name: 'houdini runtime core',
        includes: ['$houdini/runtime', 'src/client.ts'],
        excludes: [
          'vite/preload-helper',
          '$houdini/index.js',
          'houdini.config.js',
          'src/client.ts',
          'sveltejs'
        ]
      },
      {
        name: 'houdini runtime svelte',
        includes: ['$houdini/plugins/houdini-svelte/runtime', 'src/client.ts'],
        excludes: ['vite/preload-helper', '$houdini/runtime', '$houdini/index.js', 'svelte']
      },
      {
        name: 'houdini full e2e',
        includes: ['$houdini', 'src/client.ts', 'houdini.config.js'],
        excludes: ['vite/preload-helper', 'svelte']
      }
    ])
  ]
};

export default config;
