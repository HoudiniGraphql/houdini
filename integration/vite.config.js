import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit(), houdini()]
};

export default config;
