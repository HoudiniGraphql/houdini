import preprocess from 'svelte-preprocess'
import path from 'path'
import { mdsvex } from 'mdsvex'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

/** @type {import('@sveltejs/kit').Config} */
export default {
	extensions: ['.svelte', '.svx', '.md'],
	preprocess: [
		preprocess(),
		mdsvex({
			extensions: ['.md'],
			layout: './src/components/Docs.layout.svelte',
			smartypants: {
				backticks: false,
			},
			rehypePlugins: [
				rehypeSlug,
				[
					rehypeAutolinkHeadings,
					{
						behavior: 'append',
						content: {
							type: 'element',
							tagName: 'span',
							properties: { className: ['hash-link'] },
							children: [],
						},
					},
				],
			],
		}),
	],

	kit: {
		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
		vite: {
			resolve: {
				alias: {
					$components: path.resolve('./src/components'),
				},
			},
		},
	},
}
