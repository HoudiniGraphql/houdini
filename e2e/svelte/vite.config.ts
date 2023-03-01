import { svelte } from '@sveltejs/vite-plugin-svelte'
import houdini from 'houdini/vite'
import * as path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [houdini(), svelte()],

	resolve: {
		alias: {
			$houdini: path.resolve('$houdini'),
		},
	},
})
