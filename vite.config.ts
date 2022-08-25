/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	test: {
		setupFiles: [path.resolve('./vitest.setup.ts')],
	},
})
