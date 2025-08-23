import type { DocumentArtifact, GraphQLValue } from 'houdini'
import { defaultComponentField, type Cache } from 'houdini/src/runtime/cache/cache'
import { getFieldsForType } from 'houdini/src/runtime/lib/selection'

export function injectComponents({
	cache,
	selection,
	data,
	variables,
	parentType = 'Query',
}: {
	cache: Cache
	selection: DocumentArtifact['selection']
	data: GraphQLValue | null
	variables: Record<string, GraphQLValue> | undefined | null
	parentType?: string
}) {
	// if the value is null, we're done
	if (data === null) {
		return
	}

	// if the value is not an object (ie its a scalar) we're done
	if (typeof data !== 'object') {
		return
	}

	// if the value is an array we need to instantiate each item
	if (Array.isArray(data)) {
		data.forEach((item) =>
			injectComponents({
				cache,
				selection,
				data: item,
				variables,
				parentType,
			})
		)
		return
	}

	// if the object has a subselection we need to walk down
	const typename = data['__typename'] as string
	const fields = getFieldsForType(selection, typename, false)
	if (!fields) {
		return
	}

	// walk down each field
	for (const [field, subSelection] of Object.entries(fields)) {
		// if the field is a component then we need to assign the value to the target
		if (subSelection.component) {
			// if the component is already in the cache, we're done
			if (!cache._internal_unstable.componentCache[subSelection.component.key]) {
				continue
			}

			data[field] = defaultComponentField({
				variables,
				parent: cache._internal_unstable.id(parentType, data) ?? '',
				cache,
				component: subSelection.component,
			}) as any as GraphQLValue
		}

		// if there is a selection, we need to walk down
		const dataValue = data[field]
		if (subSelection.selection) {
			injectComponents({
				cache,
				selection: subSelection.selection,
				data: dataValue,
				variables,
				parentType: subSelection.type,
			})
		}
	}
}
