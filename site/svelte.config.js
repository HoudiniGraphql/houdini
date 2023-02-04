import adapter from '@sveltejs/adapter-auto'
import { mdsvex } from 'mdsvex'
import path from 'path'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import preprocess from 'svelte-preprocess'
import './src/lib/highlight.js'
import { codeTitles } from './plugins/code-titles.js'
import docsLang from './plugins/docs-lang.js'
import mermaid from './plugins/mermaid.js'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Pick up both .svelte and .svx files
	extensions: ['.svelte', '.svx'],

	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [
		mermaid,
		docsLang,
		mdsvex({
			layout: {
				blank: path.resolve('./src/layouts/_blank.svelte'),
				_: path.resolve('./src/layouts/_page.svelte')
			},
			rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
			remarkPlugins: [codeTitles]
		}),
		preprocess()
	],

	kit: {
		adapter: adapter()
	}
}

export default config
