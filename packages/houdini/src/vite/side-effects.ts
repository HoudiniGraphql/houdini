import type { Plugin } from 'vite'

import { posixify } from '../lib/path.js'

/**
 * Marks every module under the given directory as free of side effects.
 *
 * Generated documents are reached through barrels (`export *` in the stores index), and a
 * generated store declares `class X extends QueryStore`. The runtime module QueryStore comes
 * from has import-time state, so the bundler treats the `extends` as a side effect and must
 * evaluate every store any route reaches through the barrel. That pulls every store and its
 * artifact into one shared chunk instead of the route that uses it.
 * Only point this at a directory whose modules do nothing when imported.
 */
export function side_effect_free(directory: string): Plugin {
	return {
		name: 'houdini-side-effect-free',
		// module side effects only matter when bundling
		apply: 'build',
		transform: {
			filter: { id: new RegExp(`^${escape_regex(posixify(directory))}/`) },
			handler: () => ({ moduleSideEffects: false }),
		},
	}
}

function escape_regex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
