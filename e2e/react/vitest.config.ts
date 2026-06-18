import react from '@vitejs/plugin-react'
import houdini from 'houdini/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [houdini(), react()],
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.{ts,tsx}'],
	},
})
