import type { SubscriptionSelection } from './types.js'

export function getFieldsForType(
	selection: SubscriptionSelection,
	__typename: string | undefined | null,
	loading: boolean
): Required<SubscriptionSelection>['fields'] {
	// if we are loading, then we either have loading types or we return the base fields
	if (loading) {
		if (selection.loadingTypes && selection.loadingTypes.length > 0) {
			return deepMerge(
				...selection.loadingTypes.map((type) => selection.abstractFields?.fields[type])
			)
		}

		return selection.fields ?? {}
	}

	// we need to figure out the correct selection by looking at the actual type
	// and evaluating which selection is the right fit

	let targetSelection = selection.fields || {}
	// if we have abstract fields, grab the __typename and include them in the list
	if (selection.abstractFields && __typename) {
		// if the type needs to be mapped to an abstract one, use that selection instead
		const mappedType = selection.abstractFields.typeMap[__typename]
		if (mappedType) {
			targetSelection = selection.abstractFields.fields[mappedType]!
		} else if (selection.abstractFields.fields[__typename]) {
			targetSelection = selection.abstractFields.fields[__typename]!
		}
	}

	return targetSelection
}

// This function performs a very simple deep merge that shouldn't be used in an open ended response.
// It's not resilient to things like circular references so it should really only be used for loading states (for now).
function deepMerge(...objects: (Record<string, any> | undefined)[]) {
	const mergedObj: Record<string, any> = {}
	for (let obj of objects) {
		if (!obj) {
			continue
		}
		for (let prop in obj) {
			if (prop in obj) {
				const val = obj[prop]

				if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
					mergedObj[prop] = deepMerge((mergedObj[prop] as Record<string, any>) || {}, val)
				} else {
					mergedObj[prop] = val
				}
			}
		}
	}

	return mergedObj
}
