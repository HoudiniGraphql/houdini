import { SubscriptionSelection } from './types'

export function getFieldsForType(
	selection: SubscriptionSelection,
	__typename: string | undefined | null
): Required<SubscriptionSelection>['fields'] {
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
