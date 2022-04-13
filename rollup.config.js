import typescript from 'rollup-plugin-typescript2'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs'

// grab the environment variables
const { TARGET, WHICH } = process.env

// use the correct source file
const input = WHICH === 'cmd' ? 'src/cmd/main.ts' : `src/${WHICH}/index.ts`

const out = {
	cmd: {
		file: 'build/cmd.js',
		exports: 'named',
	},
	preprocess: {
		dir: `build/${WHICH.toLowerCase()}-${TARGET.toLowerCase()}`,
		exports: process.env.TARGET === 'cjs' ? 'default' : undefined,
	},
}[WHICH]

// we need to use rollup to handle esm/cjs interop.
// this is primarily because esm forces us to specify the filepath of our imports.
// typescript supports importing .ts files as .js but jest isn't happy.
export default {
	input,
	output: {
		format: TARGET === 'esm' ? 'esm' : 'cjs',
		...out,
	},
	external: ['graphql', './adapter.mjs', '$houdini'],
	plugins: [
		preserveShebangs(),
		json(),
		typescript({
			declarationDir: `build/${WHICH}-${TARGET}`,
		}),
		commonjs(),
		nodeResolve({ preferBuiltins: true }),
	],
}
