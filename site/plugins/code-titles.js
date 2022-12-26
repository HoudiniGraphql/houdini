import { visit } from 'unist-util-visit'

export function codeTitles() {
	return function gatsbyRemarkCodeTitles(tree, file) {
		visit(tree, 'code', (node, index, parent) => {
			const [language, paramsStr] = (node.lang || '').split(':')

			const params =
				paramsStr?.split('&').reduce((acc, param) => {
					const [title, value] = param.split('=')
					return {
						...acc,
						[title]: value
					}
				}, {}) ?? {}

			if (!params.title || !language) {
				return
			}

			let extraClass = ''
			if (language === 'svelte' && params.typescript) {
				extraClass = params.typescript === 'true' ? 'example-typescript' : 'example-javascript'
			}

			const titleNode = {
				type: 'html',
				value: `
		<div class="code-title ${language} ${extraClass}">${params.title}</div>
			  `.trim()
			}

			/*
			 * Splice a node back into the Markdown AST with custom title
			 */
			parent.children.splice(index, 0, titleNode)

			/*
			 * Reset to just the language
			 */
			node.lang = language
		})

		return tree
	}
}
