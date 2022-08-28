import watchAndRun from '@kitql/vite-plugin-watch-and-run'
import { sveltekit } from '@sveltejs/kit/vite'
import houdini from 'houdini/vite'
import path from 'path'

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [houdini(), sveltekit()],
}

export default config
