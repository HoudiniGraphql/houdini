import minimatch from 'minimatch'
import type { EnvironmentModuleNode } from 'vite'

import { path, getConfig, type PluginConfig, type Config } from '../lib'

export function isGraphQLFile(filepath: string): boolean {
	if (!filepath) {
		return false
	}
	// check if the file is a graphql file
	const ext = path.extname(filepath)
	return ext === '.graphql' || ext === '.gql'
}

export async function shouldReactToFileChange(filepath: string, config: Config): Promise<boolean> {
	// if (filepath.endsWith('+schema.ts') || filepath.endsWith('+schema.js')) {
	if (config.localSchema && minimatch(filepath, '**/api/+schema.*')) {
		return true
	} else {
		const schemaPath = path.join(path.dirname(config.filepath), config.schemaPath!)
		if (minimatch(filepath, schemaPath)) {
			return true
		}
	}

	return config.includeFile(filepath, { root: process.cwd() })
}

export function fileDependsOnHoudini(
	modules: EnvironmentModuleNode[],
	houdiniPath: string
): Boolean {
	// Iterate over all the related modules of the HMR event, and get what they import
	const fileDependencies = modules.reduce((acc, module) => {
		module.importedModules.forEach((importedModule) => {
			if (importedModule?.id) acc.push(importedModule.id)
		})
		return acc
	}, [] as string[])

	// check if any of the imported modules exist inside the houdini directory
	return fileDependencies.some((file) => {
		return file.startsWith(houdiniPath)
	})
}
