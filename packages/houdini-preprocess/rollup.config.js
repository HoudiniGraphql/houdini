import typescript from 'rollup-plugin-typescript2'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

// we need to use rollup to handle esm/cjs interop.
// this is primarily because esm forces us to specify the filepath of our imports.
// typescript supports importing .ts files as .js but jest isn't happy.
export default {
	input: 'src/index.ts',
	output: {
		dir: process.env.TARGET === 'esm' ? 'build/esm' : 'build/cjs',
		format: process.env.TARGET === 'esm' ? 'esm' : 'cjs',
		exports: process.env.TARGET === 'cjs' ? 'default' : undefined,
	},
	// don't worry about bundling the other houdini packages along with preprocess
	external: ['houdini-common', 'houdini', 'graphql'],
	plugins: [
		typescript({
			declarationDir: process.env.TARGET === 'esm' ? 'build/esm' : 'build/cjs',
		}),
		commonjs(),
		nodeResolve(),
	],
}
