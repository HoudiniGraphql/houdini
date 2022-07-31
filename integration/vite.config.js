import watchAndRun from '@kitql/vite-plugin-watch-and-run';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import houdini from 'houdini/vite';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit(), houdini()]
};

export default config;
