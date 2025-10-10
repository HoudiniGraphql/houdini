import minimatch from 'minimatch'

import { path, type Config } from '../lib'

export function isGraphQLFile(filepath: string): boolean {
	if (!filepath) {
		return false
	}
	// check if the file is a graphql file
	const ext = path.extname(filepath)
	return ext === '.graphql' || ext === '.gql'
}

export async function shouldReactToFileChange(filepath: string, config: Config): Promise<boolean> {
	if (config.localSchema && minimatch(filepath, '**/api/+schema.*')) {
		return true
	} else {
		const schemaPath = path.join(path.dirname(config.filepath), config.schemaPath!)
		if (minimatch(filepath, schemaPath)) {
			return true
		}
	}

	return (
		config.includeFile(filepath, { root: process.cwd() }) && !filepath.includes(config.rootDir)
	)
}
