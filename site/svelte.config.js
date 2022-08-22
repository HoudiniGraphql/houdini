import adapter from '@sveltejs/adapter-auto'
import { mdsvex } from 'mdsvex'
import path from 'path'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import preprocess from 'svelte-preprocess'
import './src/lib/highlight.js'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Pick up both .svelte and .svx files
	extensions: ['.svelte', '.svx'],

	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [
		mdsvex({
			layout: {
				blank: path.resolve('./src/routes/_blank.svelte'),
				_: path.resolve('./src/routes/_page.svelte')
			},
			rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings]
		}),
		preprocess()
	],

	kit: {
		adapter: adapter(),
		routes: (route) => !route.startsWith('_') || route === '_content.js'
	}
}

export default config
