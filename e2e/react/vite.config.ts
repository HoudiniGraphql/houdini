import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import houdini from 'houdini/vite'
import adapter from 'houdini-adapter-node'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	server: {
		port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
	},
	plugins: [houdini({ adapter }), react(), tailwindcss()],
})
