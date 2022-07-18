import watchAndRun from '@kitql/vite-plugin-watch-and-run';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    sveltekit(),
    watchAndRun([
      {
        run: 'npm run generate',
        watch: path.resolve('src/**/*.(gql|svelte)'),
        name: 'Houdini generate'
      }
    ])
  ],
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['.']
    }
  }
};

export default config;
