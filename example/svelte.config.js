import path from 'path'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		alias: {
			$houdini: path.resolve('./$houdini'),
		},
	},
}

export default config
