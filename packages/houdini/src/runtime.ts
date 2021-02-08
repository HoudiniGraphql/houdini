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

type Data = { [key: string]: {} } | { [key: string]: {} }[]

export function applyPatch(
	patch: Patch,
	set: (newValue: Data) => void,
	currentState: Data,
	payload: Data
) {
	// a place to write updates to
	const target = currentState

	// walk down the the patch and if there was a mutation, commit the update
	if (walkPatch(patch, payload, target)) {
		set(target)
	}
}

function walkPatch(
	patch: Patch,
	payload: { [key: string]: {} } | { [key: string]: {} }[],
	target: { [key: string]: {} } | { [key: string]: {} }[]
): boolean {
	// track if we update something
	let updated = false

	// if we are walking down a list then we need to take one more step
	if (Array.isArray(payload)) {
		for (const subobj of payload) {
			// if walking down updated something and we don't think we have
			if (walkPatch(patch, subobj, target) && !updated) {
				// keep us up to date
				updated = true
			}
		}

		// we're done with this entry (ignore fields and edges on lists)
		return updated
	}

	// look for any fields to update
	for (const fieldName of Object.keys(patch.fields)) {
		// update the target object at every path we need to
		for (const path of patch.fields[fieldName]) {
			let subtarget = target
			for (const [i, entry] of path.entries()) {
				// if we are looking at the last element
				if (i === path.length - 1) {
					// only update fields if the id's match
					if (subtarget.id === payload.id) {
						// we need to update the field
						subtarget[entry] = payload[fieldName]

						// track that we did something
						updated = true
					}
				} else {
					subtarget = subtarget[entry]
				}
			}
		}
	}

	// walk down any related fields
	for (const edgeName of Object.keys(patch.edges)) {
		// walk down and keep track if we updated anything
		if (walkPatch(patch.edges[edgeName], payload[edgeName], target) && !updated) {
			updated = true
		}
	}

	// bubble up if there was an update
	return updated
}
