import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';
import { libReporter } from 'vite-plugin-lib-reporter';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [houdini(), sveltekit()]
};

export default config;
