import react from '@vitejs/plugin-react'
import adapter from 'houdini-adapter-spa'
import houdini from 'houdini/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	server: {
		port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
	},
	plugins: [houdini({ adapter }), react({ fastRefresh: false })],
})
