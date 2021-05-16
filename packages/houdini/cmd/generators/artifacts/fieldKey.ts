// external imports
import graphql from 'graphql'

// we need to generate a static key that we can use to index this field in the cache.
// this needs to be a unique hash driven by the field's attribute and arguments
// returns the key for a specific field
export default function fieldKey(printed: string, field: graphql.FieldNode): string {
	// we're going to hash a field by creating a json object and adding it
	// to the attribute name
	const attributeName = field.alias?.value || field.name.value

	const argObj = (field.arguments || []).reduce<{ [key: string]: string }>((acc, arg) => {
		// the query already contains a serialized version of the argument so just pull it out of the
		// document string
		const start = arg.value.loc?.start
		const end = arg.value.loc?.end

		// if the argument is not in the query, life doesn't make sense
		if (!start || !end) {
			return acc
		}

		return {
			...acc,
			[arg.name.value]: printed.substring(start, end),
		}
	}, {})

	return Object.values(argObj).length > 0
		? `${attributeName}(${Object.entries(argObj)
				.map((entries) => entries.join(': '))
				.join(', ')})`
		: attributeName
}
