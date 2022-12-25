// this preprocessor is responsible for leaving 2 different code blocks behind
// the UI will hide/show the appropriate one depending on which language the user
// has selected

export default {
	async markup({ content, filename }) {
		// only consider .svx files
		if (!filename.endsWith('.svx')) {
			return
		}

		// instead of getting super fancy with an AST, we're just going to
		// do operations on the string content.

		// in order to add the codeblocks back, we need to keep track of the list
		// in reverse order (so the index is always valid)
		const newBlocks = []

		// our goal is to look for the content between ```typescript and ```
		for (const match of [...content.matchAll(new RegExp('```typescript', 'gi'))]) {
			// find the end of the codeblock
			for (let endIndex = match.index + 3; endIndex < content.length; endIndex++) {
				// look for the index where the 3 characters are ```
				if (content.slice(endIndex, endIndex + 3) !== '```') {
					continue
				}
				// we actually need to treat the block as ending 2 indices later
				endIndex += 3

				// we found the end of the code block
				let codeBlock = content.slice(match.index, endIndex)

				// the first thing we need to do is mark this as a javascript plugin instead
				codeBlock = codeBlock.replace('```typescript', '```typescript')
				codeBlock = codeBlock.replace('.ts', '.js')

				// push the new block at the beginning
				newBlocks.unshift({
					index: endIndex,
					block: codeBlock
				})

				// we're done processing this block
				break
			}
		}

		// now that we have the list of codeblocks, insert them into the original script
		let final = content
		for (const { index, block } of newBlocks) {
			final = final.substring(0, index) + '\n' + block + final.substring(index)
		}

		return {
			code: final
		}
	}
}
