import path from 'path'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import commonjs from '@rollup/plugin-commonjs'
import url from '@rollup/plugin-url'
import svelte from 'rollup-plugin-svelte'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
import sveltePreprocess from 'svelte-preprocess'
import typescript from '@rollup/plugin-typescript'
import alias from '@rollup/plugin-alias'
import config from 'sapper/config/rollup.js'
import pkg from './package.json'
import { preprocessor as houdiniPreprocessor } from 'houdini-compiler'

const mode = process.env.NODE_ENV
const dev = mode === 'development'
const legacy = !!process.env.SAPPER_LEGACY_BUILD

const onwarn = (warning, onwarn) =>
	(warning.code === 'MISSING_EXPORT' && /'preload'/.test(warning.message)) ||
	(warning.code === 'CIRCULAR_DEPENDENCY' && /[/\\]@sapper[/\\]/.test(warning.message)) ||
	warning.code === 'THIS_IS_UNDEFINED' ||
	onwarn(warning)

const artifactDirectory = path.join(__dirname, 'generated')

export default {
	client: {
		input: config.client.input().replace(/\.js$/, '.ts'),
		output: config.client.output(),
		plugins: [
			replace({
				'process.browser': true,
				'process.env.NODE_ENV': JSON.stringify(mode),
			}),
			svelte({
				preprocess: [
					sveltePreprocess(),
					houdiniPreprocessor({
						artifactDirectory,
						artifactDirectoryAlias: 'generated',
					}),
				],
				compilerOptions: {
					dev,
					hydratable: true,
				},
			}),
			url({
				sourceDir: path.resolve(__dirname, 'src/node_modules/images'),
				publicPath: '/client/',
			}),
			resolve({
				browser: true,
				dedupe: ['svelte'],
			}),
			commonjs(),
			typescript({ sourceMap: dev }),
			alias({
				resolve: ['.jsx', '.js', '.ts', '.tsx', '.svelte'],
				entries: [
					{
						find: 'generated',
						replacement: './generated',
					},
					{
						find: 'components',
						replacement: './src/components',
					},
				],
			}),

			legacy &&
				babel({
					extensions: ['.js', '.mjs', '.html', '.svelte'],
					babelHelpers: 'runtime',
					exclude: ['node_modules/@babel/**'],
					presets: [
						[
							'@babel/preset-env',
							{
								targets: '> 0.25%, not dead',
							},
						],
					],
					plugins: [
						'@babel/plugin-syntax-dynamic-import',
						[
							'@babel/plugin-transform-runtime',
							{
								useESModules: true,
							},
						],
					],
				}),

			!dev &&
				terser({
					module: true,
				}),
		],

		preserveEntrySignatures: false,
		onwarn,
	},

	server: {
		input: { server: config.server.input().server.replace(/\.js$/, '.ts') },
		output: config.server.output(),
		plugins: [
			replace({
				'process.browser': false,
				'process.env.NODE_ENV': JSON.stringify(mode),
			}),
			svelte({
				preprocess: [
					sveltePreprocess(),
					houdiniPreprocessor({
						artifactDirectory,
						artifactDirectoryAlias: 'generated',
					}),
				],
				compilerOptions: {
					dev,
					generate: 'ssr',
					hydratable: true,
				},
				emitCss: false,
			}),
			url({
				sourceDir: path.resolve(__dirname, 'src/node_modules/images'),
				publicPath: '/client/',
				emitFiles: false, // already emitted by client build
			}),
			resolve({
				dedupe: ['svelte'],
			}),
			commonjs(),
			typescript({ sourceMap: dev }),
			alias({
				resolve: ['.jsx', '.js', '.ts', '.tsx'],
				entries: [
					{
						find: 'generated',
						replacement: './generated',
					},
				],
			}),
		],
		external: Object.keys(pkg.dependencies).concat(require('module').builtinModules),

		preserveEntrySignatures: 'strict',
		onwarn,
	},
}
