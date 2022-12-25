import { visit } from 'unist-util-visit'

export function codeTitles() {
	return function gatsbyRemarkCodeTitles(tree, file) {
		visit(tree, 'code', (node, index, parent) => {
			const [language, params] = (node.lang || '').split(':')

			const { title } =
				params?.split('&').reduce((acc, param) => {
					const [title, value] = param.split('=')
					return {
						...acc,
						[title]: value
					}
				}, {}) ?? {}

			if (!title || !language) {
				return
			}

			const className = 'code-title'

			const titleNode = {
				type: 'html',
				value: `
		<div class="${className} ${language}">${title}</div>
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
