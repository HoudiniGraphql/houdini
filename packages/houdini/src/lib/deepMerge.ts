import merge from 'deepmerge'

import { HoudiniError } from './error'

export function deepMerge(filepath: string, ...targets: {}[]): {} {
	try {
		if (targets.length === 1) {
			return targets[0]
		} else if (targets.length === 2) {
			return merge(targets[0], targets[1])
		}

		return deepMerge(filepath, targets[0], deepMerge(filepath, ...targets.slice(1)))
	} catch (e) {
		throw new HoudiniError({ filepath, message: 'could not merge: ' + targets })
	}
}
