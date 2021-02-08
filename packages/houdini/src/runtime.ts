// externals
import { Patch } from 'houdini-compiler'
// locals
import { getEnvironment } from './environment'

// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
export function fetchQuery({
	text,
	variables,
}: {
	text: string
	variables: { [name: string]: unknown }
}) {
	return getEnvironment()?.sendRequest({ text, variables })
}

export function applyPatch<_StateType, _PayloadType>(
	patch: Patch,
	set: (newValue: _StateType) => void,
	currentState: _StateType,
	payload: _PayloadType
) {
	// a place to write updates to
	const target = currentState

	// walk down the the patch and if there was a mutation, commit the update
	if (walkPatch(patch, currentState, payload, target)) {
		set(target)
	}
}

function walkPatch<_StateType, _PayloadType>(
	patch: Patch,
	currentState: _StateType,
	payload: _PayloadType,
	target: _StateType
): boolean {
	// we will update something if we have fields up date
	let updated = Object.keys(patch.fields).length > 0

	// look for any fields to update
	for (const fieldName of Object.keys(patch.fields)) {
		// update the target object
	}

	// bubble up if there was an update
	return updated
}
