import typescript from 'rollup-plugin-typescript2'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs'

// grab the environment variables
const { TARGET, WHICH } = process.env

// use the correct source file
const input = WHICH === 'runtime' ? 'runtime/index.ts' : 'cmd/main.ts'
// figure out where we are putting stuff
const out =
	WHICH === 'cmd'
		? {
				file: 'build/cmd.js',
		  }
		: {
				dir: `build/${WHICH.toLowerCase()}-${TARGET.toLowerCase()}`,
		  }

// we need to use rollup to handle esm/cjs interop.
// this is primarily because esm forces us to specify the filepath of our imports.
// typescript supports importing .ts files as .js but jest isn't happy.
export default {
	input,
	output: {
		...out,
		format: TARGET === 'esm' ? 'esm' : 'cjs',
		exports: 'named',
	},
	external: ['graphql', 'houdini-common', './adapter.mjs'],
	plugins: [
		preserveShebangs(),
		json(),
		typescript({
			declarationDir: process.env.TARGET === 'esm' ? 'build/cmd-esm' : 'build/cjs',
		}),
		commonjs(),
		nodeResolve(),
	],
}
