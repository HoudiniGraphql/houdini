import react from '@vitejs/plugin-react'
import houdini from 'houdini/vite'
import adapter from 'houdini-adapter-node'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [houdini({ adapter }), react()],
	server: {
		watch: {
			usePolling: true,
			interval: 300,
		},
	},
})
