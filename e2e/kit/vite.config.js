import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';


/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    houdini(),
    sveltekit(),
    { name: 'aliases',
      config(config, env) {
        return {
          ...config,
          resolve: {
          ...config.resolve,
            alias: {
              '$lib': '/src/lib',
              '$lib/*': '/src/lib/*',
            }
          }
        }
      },

    }
  ]
};

export default config;
