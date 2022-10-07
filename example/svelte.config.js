import path from 'path'
import sveltePreprocess from 'svelte-preprocess'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [sveltePreprocess()],
	kit: {
		alias: {
			$houdini: path.resolve('./$houdini'),
		},
	},
}

export default config
