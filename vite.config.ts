/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	test: {
		include: ['./packages/*/src/**/*.test.{ts,js}'],
		setupFiles: [path.resolve('./vitest.setup.ts')],
		alias: {
			$houdini: './packages/houdini/src/runtime',
		},
	},
})
