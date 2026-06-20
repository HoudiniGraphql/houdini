import fs from 'node:fs/promises'

/**
 * Write a package.json file with consistent formatting
 */
export async function writePackageJson(filePath, packageJson) {
	// include a trailing newline so recompiling doesn't leave a spurious diff
	// against the committed (newline-terminated) package.json files
	await fs.writeFile(filePath, JSON.stringify(packageJson, null, 4) + '\n')
}

/**
 * Sort exports object for consistent ordering
 */
export function sortExports(exports) {
	if (!exports || typeof exports !== 'object') {
		return exports
	}

	// Define a custom sort order for exports
	const sortOrder = [
		'./package.json',  // Always first
		'.',               // Main export second
		'./*',             // Main wildcard third
	]

	// Get all export keys and sort them
	const keys = Object.keys(exports)
	
	// Separate keys into priority and regular keys
	const priorityKeys = []
	const regularKeys = []
	
	for (const key of keys) {
		const priorityIndex = sortOrder.indexOf(key)
		if (priorityIndex !== -1) {
			priorityKeys[priorityIndex] = key
		} else {
			regularKeys.push(key)
		}
	}
	
	// Sort regular keys alphabetically, but group directory exports with their wildcards:
	// 1. Directory exports (./dirname) immediately followed by their wildcards (./dirname/*)
	// 2. Then specific file exports (./dirname/filename)
	regularKeys.sort((a, b) => {
		// Extract the directory part for grouping
		const getDirectory = (key) => {
			if (key.endsWith('/*')) {
				return key.slice(0, -2) // Remove /*
			}
			const slashIndex = key.indexOf('/', 2) // Find slash after ./
			return slashIndex === -1 ? key : key.substring(0, slashIndex)
		}
		
		const aDir = getDirectory(a)
		const bDir = getDirectory(b)
		
		// If different directories, sort by directory name
		if (aDir !== bDir) {
			return aDir.localeCompare(bDir)
		}
		
		// Same directory - group directory export, then wildcard, then specific files
		const aIsDirectory = a === aDir
		const bIsDirectory = b === bDir
		const aIsWildcard = a === aDir + '/*'
		const bIsWildcard = b === bDir + '/*'
		
		if (aIsDirectory && !bIsDirectory) return -1
		if (!aIsDirectory && bIsDirectory) return 1
		if (aIsWildcard && !bIsWildcard && !bIsDirectory) return -1
		if (!aIsWildcard && bIsWildcard && !aIsDirectory) return 1
		
		// Same type within same directory, sort alphabetically
		return a.localeCompare(b)
	})
	
	// Combine priority keys (filtering out undefined) with sorted regular keys
	const sortedKeys = [...priorityKeys.filter(Boolean), ...regularKeys]
	
	// Create new sorted exports object
	const sortedExports = {}
	for (const key of sortedKeys) {
		sortedExports[key] = exports[key]
	}
	
	return sortedExports
}

/**
 * Sort an array of file/directory names for consistent ordering
 */
export function sortFiles(files) {
	return [...files].sort()
}

/**
 * Clean workspace dependencies from package.json
 */
export function cleanWorkspaceDependencies(packageJson) {
	const cleaned = { ...packageJson }
	
	// Clean devDependencies
	if (cleaned.devDependencies) {
		for (const [key, value] of Object.entries(cleaned.devDependencies)) {
			if (value === 'workspace:^') {
				delete cleaned.devDependencies[key]
			}
		}
	}
	
	// Clean dependencies
	if (cleaned.dependencies) {
		for (const [key, value] of Object.entries(cleaned.dependencies)) {
			if (value === 'workspace:^') {
				delete cleaned.dependencies[key]
			}
		}
	}
	
	return cleaned
}
