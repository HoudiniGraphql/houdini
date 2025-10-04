import type { SubscriptionSelection } from './types'

export function getFieldsForType(
	selection: SubscriptionSelection,
	__typename: string | undefined | null,
	loading: boolean,
): Required<SubscriptionSelection>['fields'] {
	// if we are loading, then we either have loading types or we return the base fields
	if (loading) {
		if (selection.loadingTypes && selection.loadingTypes.length > 0) {
			return deepMerge(
				...selection.loadingTypes.map(
					(type) => selection.abstractFields?.fields[type],
				),
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
			// biome-ignore lint/style/noNonNullAssertion: Mapped type is guaranteed to exist in fields
			targetSelection = selection.abstractFields.fields[mappedType]!
		} else if (selection.abstractFields.fields[__typename]) {
			// biome-ignore lint/style/noNonNullAssertion: Typename is guaranteed to exist in fields
			targetSelection = selection.abstractFields.fields[__typename]!
		}
	}

	return targetSelection
}

// This function performs a very simple deep merge that shouldn't be used in an open ended response.
// It's not resilient to things like circular references so it should really only be used for loading states (for now).
// biome-ignore lint/suspicious/noExplicitAny: Deep merge needs to handle any object structure
function deepMerge(...objects: (Record<string, any> | undefined)[]) {
	// biome-ignore lint/suspicious/noExplicitAny: Merged object can contain any values
	const mergedObj: Record<string, any> = {}
	for (const obj of objects) {
		if (!obj) {
			continue
		}
		for (const prop in obj) {
			if (prop in obj) {
				const val = obj[prop]

				if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
					mergedObj[prop] = deepMerge(
						// biome-ignore lint/suspicious/noExplicitAny: Type assertion for deep merge
						(mergedObj[prop] as Record<string, any>) || {},
						val,
					)
				} else {
					mergedObj[prop] = val
				}
			}
		}
	}

	return mergedObj
}
