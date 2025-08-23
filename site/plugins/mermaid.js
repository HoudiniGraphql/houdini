import mermaid from 'mermaid'
import { insert } from './docs-lang.js'

// this preprocessor renders mermaid diagrams
export default {
	async markup({ content, filename }) {
		// only consider .svx files
		if (!filename.endsWith('.svx')) {
			return
		}

		let newContent = content

		// our goal is to look for the content between ```mermaid and ```
		const matches = [...content.matchAll(new RegExp('```mermaid', 'gi'))].reverse()
		for (const match of matches) {
			let done = false
			// find the end of the codeblock
			for (let endIndex = match.index + 3; endIndex < content.length; endIndex++) {
				// look for the index where the 3 characters are ```
				if (content.substring(endIndex, endIndex + 3) !== '```') {
					continue
				}
				// we actually need to treat the block as ending 2 indices later
				endIndex += 3

				// the content of the block is between the two indices
				const blockContent = content.substring(match.index, endIndex)

				// only add something if we have a mermaid
				if (!blockContent.includes('mermaid')) {
					done = true
					break
				}

				const diagramText = blockContent.substring(
					'```mermaid'.length,
					blockContent.length - '```'.length
				)

				const replacedText = `
<pre class="mermaid">${diagramText.trim()}</pre>
`
				done = true
				newContent =
					newContent.substring(0, match.index) +
					'\n' +
					replacedText +
					newContent.substring(endIndex)
				break
			}
			if (!done) {
				// if we got this far we didn't see a close
				throw new Error(
					`didn't find close: ${match.index} @ ${content.substring(
						match.index - 20,
						match.index
					)}**${content[match.index]}**${content.substring(match.index + 1)}`
				)
			}
		}

		return {
			code: newContent
		}
	}
}
