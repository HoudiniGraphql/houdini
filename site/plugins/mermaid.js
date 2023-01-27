import mermaid from 'mermaid'
import { insert } from './docs-lang.js'

// this preprocessor renders mermaid diagrams
export default {
	async markup({ content, filename }) {
		// only consider .svx files
		if (!filename.endsWith('.svx')) {
			return
		}

		// our goal is to look for the content between ```mermaid and ```
		for (const match of [...content.matchAll(new RegExp('```mermaid', 'gi'))]) {
			// find the end of the codeblock
			for (let endIndex = match.index + 3; endIndex < content.length; endIndex++) {
				// look for the index where the 3 characters are ```
				if (content.slice(endIndex, endIndex + 3) !== '```') {
					continue
				}
				// we actually need to treat the block as ending 2 indices later
				endIndex += 3

				// the content of the block is between the two indices
				const blockContent = content.slice(match.index, endIndex)

				// only add something if we have a mermaid
				if (!blockContent.includes('mermaid')) {
					break
				}

				const diagramText = blockContent.slice(
					'```mermaid'.length,
					blockContent.length - '```'.length
				)

				const replacedText = `
<pre class="mermaid">${diagramText.trim()}</pre>
`

				content =
					content.substring(0, match.index) + '\n' + replacedText + blockContent.substring(endIndex)

				// we're done processing this block
				break
			}
		}

		return {
			code: content
		}
	}
}
