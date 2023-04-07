import type { SubscriptionSelection } from './types'

export function getFieldsForType(
	selection: SubscriptionSelection,
	__typename: string | undefined | null,
	loading: boolean
): Required<SubscriptionSelection>['fields'] {
	// if we are loading, then we either have loading types or we return the base fields
	if (loading) {
		if (selection.loadingTypes && selection.loadingTypes.length > 0) {
			return Object.assign(
				{},
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
