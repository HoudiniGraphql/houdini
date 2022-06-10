import adapter from '@sveltejs/adapter-auto';
import houdini from 'houdini/preprocess';
import path from 'path';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [preprocess(), houdini()],

  kit: {
    adapter: adapter(),
    vite: {
      resolve: {
        alias: {
          $houdini: path.resolve('./$houdini'),
          $lib: path.resolve('./src/lib')
        }
      },
      server: {
        fs: {
          // Allow serving files from one level up to the project root
          allow: ['..']
        }
      }
    }
  }
};

export default config;
