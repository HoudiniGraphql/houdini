import react from '@vitejs/plugin-react'
import adapter from 'houdini-adapter-auto'
import houdini from 'houdini/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [houdini({ adapter }), react({ fastRefresh: false })],
})
