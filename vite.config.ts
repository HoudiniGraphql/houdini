/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	test: {
		include: [path.resolve('packages', '*', 'src', '**', '*.test.ts')],
		setupFiles: [path.resolve('./vitest.setup.ts')],
		alias: {
			$houdini: './packages/houdini/src/runtime',
		},
	},
})
