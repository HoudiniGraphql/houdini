import { getFieldsForType } from '$houdini/runtime/lib/selection'
import type { ClientPlugin, DocumentArtifact, GraphQLValue } from 'houdini'

const plugin: () => ClientPlugin = () => () => {
	return {
		beforeNetwork(ctx, { next }) {
			next({
				...ctx,
				cacheParams: {
					...ctx.fetchParams,
					serverSideFallback: false,
				},
			})
		},
		end(ctx, { resolve, value }) {
			let result = { ...value }
			// if the artifact has component fields we need to
			if (ctx.artifact.hasComponents) {
				console.log(ctx.artifact.name, 'has components')
				// we need to walk down the artifacts selection and instantiate any component fields
				instantiateComponentFields(ctx.artifact.selection, result.data)
			}

			// keep going
			resolve(ctx, result)
		},
	}
}

function instantiateComponentFields(
	selection: DocumentArtifact['selection'],
	data: GraphQLValue | null
) {
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
		data.forEach((item) => instantiateComponentFields(selection, item))
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
		// if the object has a component, we need to instantiate it
		if (subSelection.selection?.components) {
			console.log('adding component to', subSelection.selection?.components)
		}

		// if there is a selection, we need to walk down
		const dataValue = data[field]
		if (subSelection.selection && dataValue && typeof dataValue === 'object') {
			instantiateComponentFields(subSelection.selection, dataValue)
		}
	}
}

export default plugin
