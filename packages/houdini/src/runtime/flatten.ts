import type { NestedList } from './types.js'

// flatten processes a deeply nested lists of lists
export function flatten<T>(source?: NestedList<T>): T[] {
	// if we dont have a list we're done
	if (!source) {
		return []
	}

	return source.reduce<T[]>((acc, element) => {
		// null values get ignored
		if (!element) {
			return acc
		}

		// if we found an array, flatten it
		if (Array.isArray(element)) {
			return acc.concat(flatten(element))
		}

		// if we found an element, add it to the parent
		return acc.concat(element)
	}, [])
}
