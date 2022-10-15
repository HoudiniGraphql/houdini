import * as graphql from 'graphql'

import { Config } from '../../../lib'

// we need to generate a static key that we can use to index this field in the cache.
// this needs to be a unique hash driven by the field's attribute and arguments
// returns the key for a specific field
export default function fieldKey(config: Config, field: graphql.FieldNode): string {
	// we're going to hash a field by creating a json object and adding it
	// to the attribute name
	const attributeName = field.alias?.value || field.name.value

	// field might not have a location so print and re-parse before we look at serialized values
	const printed = graphql.print(field)
	const secondParse = (
		graphql.parse(`{${printed}}`).definitions[0] as graphql.OperationDefinitionNode
	).selectionSet.selections[0] as graphql.FieldNode

	// if the field is paginated, we need to strip away any args
	const paginated = !!field.directives?.find(
		(directive) => directive.name.value === config.paginateDirective
	)
	const paginationArgs = ['first', 'after', 'last', 'before', 'limit', 'offset']

	const argObj = (secondParse.arguments || []).reduce<{ [key: string]: string }>((acc, arg) => {
		// the query already contains a serialized version of the argument so just pull it out of the
		// document string
		const start = arg.value.loc?.start
		const end = arg.value.loc?.end

		// if the field is paginated, ignore the pagination args in the key
		if (paginated && paginationArgs.includes(arg.name.value)) {
			return acc
		}

		// if the argument is not in the query, life doesn't make sense
		if (!start || !end) {
			return acc
		}

		return {
			...acc,
			[arg.name.value]: printed.substring(start - 1, end - 1),
		}
	}, {})

	let key =
		Object.values(argObj).length > 0
			? `${attributeName}(${Object.entries(argObj)
					.map((entries) => entries.join(': '))
					.join(', ')})`
			: attributeName

	// if the field is paginated, key it differently so other documents can ask for the non paginated value without conflict
	if (paginated) {
		key = key + '::paginated'
	}

	return key
}
