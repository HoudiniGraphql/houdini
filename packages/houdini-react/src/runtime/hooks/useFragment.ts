import cache from '$houdini/runtime/cache'
import type { GraphQLObject, FragmentArtifact } from '$houdini/runtime/lib/types'
import { fragmentKey } from '$houdini/runtime/lib/types'

import { useLiveDocument } from './useLiveDocument'

export function useFragment<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends {} = {}
>(
	reference: _Data | { [fragmentKey]: _ReferenceType } | null,
	document: { artifact: FragmentArtifact }
) {
	// @ts-expect-error: typescript can't guarantee that the fragment key is defined
	// but if its not, then the fragment wasn't mixed into the right thing
	// the variables for the fragment live on the initial value's $fragment key
	const { variables, parent } = reference?.[fragmentKey]?.[artifact.name] ?? {}
	if (reference && fragmentKey in reference && (!variables || !parent)) {
		console.warn(
			`⚠️ Parent does not contain the information for this fragment. Something is wrong.
Please ensure that you have passed a record that has ${document.artifact.name} mixed into it.`
		)
	}

	// if we got this far then we are safe to use the fields on the object
	let initialValue = reference as _Data | null

	// on the client, we want to ensure that we apply masking to the initial value by
	// loading the value from cache
	if (reference && parent) {
		initialValue = cache.read({
			selection: document.artifact.selection,
			parent,
			variables,
		}).data as _Data
	}

	// we're ready to setup the live document
	const [storeValue] = useLiveDocument<_Data, _Input>({
		artifact: document.artifact,
		variables,
		initialValue,
		send: {
			stuff: {
				parentID: parent,
			},
			// setup = true?
			// we don't need to do the first read because we
			// have an initial value...
			// does Boolean(initialValue) === { setup: true }
		},
	})

	// and use the value
	return storeValue.data
}
