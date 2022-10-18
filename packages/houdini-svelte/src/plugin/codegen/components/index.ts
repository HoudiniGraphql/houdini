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
	const files: ProjectDirs = {
		dirs: {},
		files: [],
	}

	// put every file we found in the right place
	for (const file of matches) {
		// walk down the path
		let target = files
		const parts = file.substring(1).split('/')
		for (const [i, part] of parts.entries()) {
			// if we are at the end of the path, we are looking at a file
			if (i === parts.length - 1) {
				target.files.push(part)
				continue
			}

			// we are on a file
			if (!target.dirs[part]) {
				target.dirs[part] = {
					dirs: {},
					files: [],
				}
			}

			// there is garunteed to be an entry for this particular filepath part
			// focus on it and move onto the next one
			target = target.dirs[part]
		}
	}

	// walk down the structure for any directories with files that match the glob

	console.log(JSON.stringify(files))
}

type ProjectDirs = {
	dirs: Record<string, ProjectDirs>
	files: string[]
}
