// @ts-nocheck
import { fs, type Adapter } from 'houdini'
import { fileURLToPath } from 'node:url'
import path from 'path'
import React from 'react'
import ReactDOM from 'react-dom/server'

// in order to prepare the app as a single-page app, we have 2 create 2 additional files:
// - an index.js that imports the application and calls React.render. This file needs to be built by vite so it's passed with the includePaths option for an adapter
// - an index.html containing the static shell that wraps the application.
const adapter: Adapter = async ({ outDir }) => {
	// the first thing we need to do is pull out the rendered html file into the root of the outDir
	await fs.copyFile(
		path.join(outDir, 'assets', '$houdini', 'temp', 'spa-shell', 'index.html'),
		path.join(outDir, 'index.html')
	)

	await fs.rmdir(path.join(outDir, 'assets', '$houdini'))
}

// make sure we include the app entry point in the bundle
adapter.includePaths = {
	app: fileURLToPath(new URL('./app.js', import.meta.url).href),
	shell: '$houdini/temp/spa-shell/index.html',
}

// we dont want any server artifacts to be generated
adapter.disableServer = true

adapter.pre = async ({ config, outDir, conventions }) => {
	process.env.HOUDINI_SECONDARY_BUILD = 'true'

	const { build } = await import('vite')

	const shellDir = conventions.temp_dir(config, 'spa-shell')

	// before we can import and render the user's index file, we need to compile it with vite
	await build({
		build: {
			emptyOutDir: false,
			ssr: true,
			rollupOptions: {
				output: {
					dir: shellDir,
					entryFileNames: '[name].js',
				},
			},
			lib: {
				entry: {
					shell: conventions.router_index_path(config),
				},
				formats: ['es'],
			},
		},
	})

	process.env.HOUDINI_SECONDARY_BUILD = 'false'

	// now we can import the bundled shell
	const { default: App } = await import(path.join(shellDir, 'shell.js'))

	// render the index.jsx file to generate the static html that
	// we can use to wrap the ajvascript application
	let shellContents = ReactDOM.renderToStaticMarkup(
		React.createElement(App, {
			children: [
				React.createElement('div', {
					id: 'app',
				}),
			],
		})
	).replace(
		'</head>',
		"<script type='module' src='$houdini/../dist/assets/app.js'></script></head>"
	)

	// write the shell to the outDir
	await fs.writeFile(path.join(shellDir, 'index.html'), shellContents)
}

export default adapter
