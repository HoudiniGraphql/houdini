import type { Config, GenerateHookInput } from 'houdini'
import { ArtifactKind, fs, path } from 'houdini'

import type { Framework } from '../../kit'

export default async function componentTypesGenerator(
	framework: Framework,
	{ config, documents }: GenerateHookInput
) {
	// if we treat the documents as the source of truth for files that match
	// we can just filter out the ones that don't apply:t
	// - in kit, exclude the route directory
	// - group the files by directory
	// - generate ./$houdini in the typeroot directory at the correct spot

	// there could be many queries in a given component so we can't just think about filepaths
	const queries: Record<string, { name: string; query: string }[]> = {}
	for (const document of documents) {
		if (document.kind !== ArtifactKind.Query) {
			continue
		}

		queries[document.filename] = (queries[document.filename] ?? []).concat({
			name: document.name,
			query: document.originalString,
		})
	}
	let matches = Object.keys(queries).filter((filepath) => filepath.endsWith('.svelte'))

	// if we are in kit, don't consider the routes directory
	if (framework === 'kit') {
		matches = matches.filter((match) => !match.startsWith(config.routesDir))
	}

	// group the files by directory
	const files: ProjectDirs = {
		dirs: {},
		files: [],
	}

	// put every file we found in the right place
	for (let file of matches) {
		// only worry about things relative to the project root
		file = path.relative(config.projectRoot, file)

		// walk down the path
		let target = files
		const parts = file.split('/')
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

			// there is guaranteed to be an entry for this particular filepath part
			// focus on it and move onto the next one
			target = target.dirs[part]
		}
	}

	// now that we've grouped together all of the files together, we can just walk down the
	// structure and generate the necessary types at the right place.
	await walk_project(config, files, queries, config.projectRoot)
}

async function walk_project(
	config: Config,
	dirs: ProjectDirs,
	queries: Record<string, { name: string; query: string }[]>,
	root: string
) {
	// process every child directory
	await Promise.all(
		Object.entries(dirs.dirs).map(async ([path_part, child]) => {
			// keep going with the new root
			return walk_project(config, child, queries, path.join(root, path_part))
		})
	)

	// if we don't have any files at this spot we're done
	if (dirs.files.length === 0) {
		return
	}

	// every query in this directory needs an entry in the file
	let typeFile = "import type { ComponentProps } from 'svelte'"
	for (const file of dirs.files) {
		const no_ext = path.parse(file).name
		const prop_type = no_ext + 'Props'

		// figure out the full file path
		const filepath = path.join(root, file)

		// we need to figure out the props for this component
		const contents = await fs.readFile(filepath)
		// make typescript happy
		if (!contents) {
			continue
		}

		// define the prop types for the component
		typeFile =
			`
import ${no_ext} from './${file}'
		` +
			typeFile +
			`
type ${prop_type} = ComponentProps<${no_ext}>
`

		// a file can contain multiple queries
		for (const query of queries[filepath]) {
			// we can't generate actual type defs for props so let's just export a
			// generic typedefinition
			typeFile =
				`
import type { ${query.name}$input } from '${path
					.relative(filepath, path.join(config.artifactDirectory, query.name))
					.replace('/$houdini', '')}'
                    ` +
				typeFile +
				`
export type ${config.variableFunctionName(
					query.name
				)} = <_Props extends ${prop_type}>(args: { props: _Props }) => ${query.name}$input
        `
		}
	}

	// we need to write this file in the correct location in the type root dir
	const relative = path.join(config.typeRootDir, path.relative(config.projectRoot, root))

	// write the file
	await fs.mkdirp(relative)
	await fs.writeFile(path.join(relative, '$houdini.d.ts'), typeFile)
}

type ProjectDirs = {
	dirs: Record<string, ProjectDirs>
	files: string[]
}
