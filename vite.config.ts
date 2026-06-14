/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	resolve: {
		alias: {
			$houdini: path.resolve('./packages/houdini/src'),
			'houdini/test': path.resolve('./packages/houdini/legacy/test'),
			'houdini/vite': path.resolve('./packages/houdini/src/vite'),
			'houdini/codegen': path.resolve('./packages/houdini/src/codegen'),
			'houdini/runtime': path.resolve('./packages/houdini/src/runtime'),
			houdini: path.resolve('./packages/houdini/src/lib'),
		},
	},
	benchmark: {
		outputJson: './perf/benchmark.json',
	},
	test: {
		include: [
			'./packages/*/src/**/*.test.{ts,js}',
			'./packages/houdini-react/runtime/**/*.test.{ts,js}',
			'./packages/houdini-core/runtime/public/**/*.test.{ts,js}',
			'./site/**/*.test.{ts,js}',
		],
		setupFiles: [path.resolve('./vitest.setup.ts')],
		coverage: {
			provider: 'v8',
		},
		environment: 'node',
		pool: 'forks',
		server: {
			deps: {
				external: ['node:sqlite'],
			},
		},
	},
})
