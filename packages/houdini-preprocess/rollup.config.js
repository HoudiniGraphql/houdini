import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import path from 'path'

export default {
	input: 'src/index.ts',
	output: {
		dir: process.env.TARGET === 'esm' ? 'build/esm' : 'build/cjs',
		format: process.env.TARGET === 'esm' ? 'esm' : 'cjs',
		exports: process.env.TARGET === 'cjs' ? 'default' : undefined,
	},
	plugins: [
		typescript({
			declarationDir: process.env.TARGET === 'esm' ? 'build/esm' : 'build/cjs',
		}),
		alias({
			entries: {
				houdini: path.resolve(__dirname, '..', 'houdini', 'build', 'cmd', 'index.js'),
				'houdini-common': path.resolve(
					__dirname,
					'..',
					'houdini-common',
					'build',
					'index.js'
				),
			},
		}),
		commonjs(),
		nodeResolve(),
	],
}
