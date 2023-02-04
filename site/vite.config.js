import { loadContent } from './src/lib/loadContent.js'
import { loadOutline } from './src/lib/loadOutline.js'
import { sveltekit } from '@sveltejs/kit/vite'
import path from 'path'

let _outline
let _content

/** @type {import('vite').UserConfig} */
const config = {
	resolve: {
		alias: {
			// these are the aliases and paths to them
			'~': path.resolve('./src')
		}
	},
	plugins: [
		sveltekit(),
		{
			async transform(code) {
				if (!_outline) {
					_outline = JSON.stringify(await loadOutline())
					_content = JSON.stringify(await loadOutline())
				}

				return {
					code: code
						.replace('REPLACE_WITH_OUTLINE', _outline)
						.replace('REPLACE_WITH_CONTENT', _content)
				}
			}
		}
	]
}

export default config
