import merge from 'deepmerge'

import { HoudiniError } from './error'

export function deepMerge<T>(filepath: string, ...targets: T[]): T {
	try {
		if (targets.length === 1) {
			return targets[0]
		} else if (targets.length === 2) {
			return merge<T>(targets[0], targets[1])
		}

		return deepMerge(filepath, targets[0], deepMerge(filepath, ...targets.slice(1)))
	} catch (e) {
		console.log(e)
		throw new HoudiniError({ filepath, message: 'could not merge: ' + targets })
	}
}
