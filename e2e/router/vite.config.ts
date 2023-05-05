import react from '@vitejs/plugin-react'
import houdini from 'houdini/vite'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [houdini(), react({ fastRefresh: false })],
	// TODO: the vite plugin should do this
	resolve: {
		alias: {
			$houdini: path.resolve('.', '/$houdini'),
			'$houdini/*': path.resolve('.', '/$houdini', '*'),
		},
	},
})
