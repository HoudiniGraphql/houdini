// externals
import glob from 'glob'
import { gqlPluckFromCodeString } from 'graphql-tag-pluck'
import * as svelte from 'svelte/compiler'
import fs from 'fs/promises'

// the main entrypoint for the mosaic compiler
async function main() {
	// the first step we have to do is grab a list of every file in the source tree
	const sourceFiles: string[] = glob.sync('src/**/*.svelte')

	// wait for every file to be processed
	await Promise.all(
		sourceFiles.map(async (filePath) => {
			// read the file
			const contents = await fs.readFile(filePath, 'utf-8')
			// the javascript bits
			let jsContent

			// pretend we are preprocessing to get access to the javascript bits
			svelte.preprocess(contents, {
				script({ content }) {
					jsContent = content
					return {
						code: content,
					}
				},
			})

			// grab the graphql document listed in the file
			const document = await gqlPluckFromCodeString(jsContent, {
				modules: [
					{ name: '$mosaic', identifier: 'graphql' },
					{ name: 'mosaic', identifier: 'graphql' },
				],
			})

			console.log(document)
		})
	)
}

main()
