import { sveltekit } from '@sveltejs/kit/vite'
import path from 'path'
import { replaceCodePlugin } from 'vite-plugin-replace'
import { loadContent } from './src/lib/loadContent.js'
import { loadOutline } from './src/lib/loadOutline.js'

/** @type {import('vite').UserConfig} */
const config = {
	optimizeDeps: {
		include: ['highlight.js/lib/core']
	},
	resolve: {
		alias: {
			// these are the aliases and paths to them
			'~': path.resolve('./src')
		}
	},
	plugins: [
		sveltekit(),
		replaceCodePlugin({
			replacements: [
				{ from: 'REPLACE_WITH_OUTLINE', to: JSON.stringify(await loadOutline()) },
				{ from: 'REPLACE_WITH_CONTENT', to: JSON.stringify(await loadContent()) }
			]
		})
	]
}

export default config
