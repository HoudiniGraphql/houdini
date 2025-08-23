/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	test: {
		include: ['./packages/*/src/**/*.test.{ts,js}', './site/**/*.test.{ts,js}'],
		setupFiles: [path.resolve('./vitest.setup.ts')],
		alias: {
			$houdini: path.resolve('./packages/houdini/src'),
			'houdini/test': path.resolve('./packages/houdini/src/test'),
			'houdini/vite': path.resolve('./packages/houdini/src/vite'),
			'houdini/codegen': path.resolve('./packages/houdini/src/codegen'),
			houdini: path.resolve('./packages/houdini/src/lib'),
		},
		coverage: {
			provider: 'v8',
		},
	},
})
