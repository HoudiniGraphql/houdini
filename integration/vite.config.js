import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/kit';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [houdini(), sveltekit()]
};

export default config;
