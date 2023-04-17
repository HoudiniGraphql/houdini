import { visit } from 'unist-util-visit'
import { format } from './docs-lang.js'

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

			if (!language || !paramsStr) {
				return
			}

			let extraClass = ''
			if (params.typescriptToggle) {
				extraClass =
					params.typescriptToggle === 'true' ? 'example-typescript' : 'example-javascript'
			}
			if (!params.title) {
				extraClass += ' empty'
			}

			const titleNode = {
				type: 'html',
				value: `
		<div class="code-title ${language} ${extraClass}">${params.title ?? ''}</div>
			  `.trim()
			}

			/*
			 * Splice a node back into the Markdown AST with custom title
			 */
			parent.children.splice(index, 0, titleNode)

			// remove any prettier ignore lines
			node.value = node.value.replaceAll(/\n\s+\/\/ prettier-ignore/g, '').replaceAll('\t', '    ')

			/*
			 * Reset to just the language
			 */
			node.lang = language
		})

		return tree
	}
}
