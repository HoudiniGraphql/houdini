import { getFieldsForType } from '$houdini/runtime/lib/selection'
import type { ClientPlugin, DocumentArtifact, GraphQLValue } from 'houdini'
import React from 'react'

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
		end(ctx, { client, resolve, value }) {
			let result = { ...value }
			// if the artifact has component fields we need to
			if (ctx.artifact.hasComponents) {
				// we need to walk down the artifacts selection and instantiate any component fields
				injectComponents(client.componentCache, ctx.artifact.selection, result.data)
			}

			// keep going
			resolve(ctx, result)
		},
	}
}

export function injectComponents(
	cache: Record<string, any>,
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
		data.forEach((item) => injectComponents(cache, selection, item))
		return
	}

	// if the object has a subselection we need to walk down
	const typename = data['__typename'] as string
	const fields = getFieldsForType(selection, typename, false)
	if (!fields) {
		return
	}

	// if the object has a component, we need to instantiate it
	if (selection?.components) {
		// add every component we need to
		for (const [key, componentRef] of Object.entries(selection.components)) {
			if (data && typeof data === 'object') {
				const componentFn = cache[key]

				// @ts-ignore
				data[componentRef.attribute] = (props: any) => {
					return React.createElement(componentFn, {
						...props,
						[componentRef.prop]: data,
					})
				}
			}
		}
	}

	// walk down each field
	for (const [field, subSelection] of Object.entries(fields)) {
		// if there is a selection, we need to walk down
		const dataValue = data[field]
		if (subSelection.selection) {
			injectComponents(cache, subSelection.selection, dataValue)
		}
	}
}

export default plugin
