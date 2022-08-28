import path from 'path'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [],

	kit: {
		alias: {
			$houdini: path.resolve('./$houdini'),
			$lib: path.resolve('./src/lib'),
		},
	},
}

export default config
