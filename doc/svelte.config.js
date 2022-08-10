import adapter from '@sveltejs/adapter-auto'
import preprocess from 'svelte-preprocess'
import { mdsvex } from 'mdsvex'
import path from 'path'
import hljs from 'highlight.js'
import hljs_svelte from 'highlightjs-svelte'
import graphqlLang from './src/lib/graphql-language.js'
import { replaceCodePlugin } from 'vite-plugin-replace'
import { loadOutline } from './src/lib/loadOutline.js'
import { loadContent } from './src/lib/loadContent.js'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

// add svelte syntax highlighting support
hljs_svelte(hljs)

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
			rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
			highlight: {
				highlighter(str, lang) {
					let code = str

					if (lang && hljs.getLanguage(lang)) {
						try {
							code = hljs
								.highlight(str.replace(/\t/g, '    '), {
									language: lang
								})
								.value.replace(/`/g, '&#96;')
								.replace(/{/g, '&#123;')
								.replace(/}/g, '&#125;')
						} catch (__) {}
					}

					return `<pre class="hljs" data-language="${lang}"><code class="hljs">{@html \`${code}\`}</code></pre>`
				}
			}
		}),
		preprocess()
	],

	kit: {
		adapter: adapter(),
		routes: (route) => !route.startsWith('_') || route === '_content.js',
		vite: {
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
				replaceCodePlugin({
					replacements: [
						{ from: 'REPLACE_WITH_OUTLINE', to: JSON.stringify(await loadOutline()) },
						{ from: 'REPLACE_WITH_CONTENT', to: JSON.stringify(await loadContent()) }
					]
				})
			]
		}
	}
}

// add graphql support to highlight js
hljs.registerLanguage('graphql', graphqlLang)

export default config
