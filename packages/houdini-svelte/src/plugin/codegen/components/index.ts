import { GenerateHookInput } from 'houdini'
import { promisify } from 'util'

import { Framework } from '../../kit'

export default async function componentTypesGenerator(
	framework: Framework,
	{ config }: GenerateHookInput
) {
	// in order to generate types for the component queries in the project we need to:
	// - look at all of the files included in the project
	// - in kit, exclude the route directory
	// - group the files by directory
	// - look for inline queries for every file in the directory and generate ./$houdini
	let matches = await config.sourceFiles()

	// if we are in kit, don't consider the source directory
	if (framework === 'kit') {
		matches = matches.filter((match) => !match.startsWith(config.routesDir))
	}

	// group the files by directory
	const files: { [filename: string]: { queries: string[]; props: {} } } = {}

	// put every file we found in the right place
	for (const file of matches) {
		// walk down the path
		let target = files
		const parts = file.split('/')
		for (const [i, path] of parts.entries()) {
			// if we are
			if (!target[path]) {
			}
		}
	}
}
