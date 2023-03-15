import react from '@vitejs/plugin-react'
import { path } from 'houdini'
import houdini from 'houdini/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [houdini(), react()],
	resolve: {
		alias: {
			$houdini: path.resolve('.', '/$houdini'),
			'$houdini/*': path.resolve('.', '/$houdini', '*'),
		},
	},
})
