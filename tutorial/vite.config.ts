import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { snapshotPlugin } from './src/plugins/snapshot'

export default defineConfig({
	server: {
		watch: {
			ignored: ['**/content/**'],
		},
	},
	plugins: [
		tanstackStart(),
		react(),
		tailwindcss(),
		snapshotPlugin(),
		{
			name: 'isolation-headers',
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
					res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
					// Prevent snapshot binaries from being cached so rebuilds
					// are picked up on the next page load without a hard refresh.
					if (req.url?.startsWith('/snapshots/')) {
						res.setHeader('Cache-Control', 'no-store')
					}
					next()
				})
			},
		},
	],
})
