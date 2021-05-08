const sveltePreprocess = require('svelte-preprocess')
const node = require('@sveltejs/adapter-node')
const pkg = require('./package.json')
const houdini = require('houdini-preprocess')
const path = require('path')

/** @type {import('@sveltejs/kit').Config} */
module.exports = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [sveltePreprocess(), houdini.default()],

	kit: {
		// By default, `npm run build` will create a standard Node app.
		// You can create optimized builds for different platforms by
		// specifying a different adapter
		adapter: node(),

		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',

		vite: {
			resolve: {
				alias: {
					$houdini: path.resolve(__dirname, '$houdini')
				}
			}
		}
	}
}
