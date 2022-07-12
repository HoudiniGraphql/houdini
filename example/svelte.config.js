import adapter from '@sveltejs/adapter-auto'
import houdini from 'houdini/preprocess'
import path from 'path'
import preprocess from 'svelte-preprocess'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [preprocess(), houdini()],

	kit: {
		adapter: adapter(),

		alias: {
			$houdini: path.resolve('./$houdini'),
			$lib: path.resolve('./src/lib'),
		},
	},
}

export default config
