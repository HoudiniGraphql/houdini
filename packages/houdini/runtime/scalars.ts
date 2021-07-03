// externals
import type { Config } from 'houdini-common'
// locals
import {
	MutationArtifact,
	QueryArtifact,
	SubscriptionArtifact,
	SubscriptionSelection,
} from './types'

export function marshalInputs<T>({
	artifact,
	config,
	input,
	rootType = '@root',
}: {
	artifact: QueryArtifact | MutationArtifact | SubscriptionArtifact
	config: Config
	input: unknown
	rootType?: string
}): {} | null | undefined {
	if (input === null || typeof input === 'undefined') {
		return input
	}

	// if there are no inputs in the object, nothing to do
	if (!artifact.input) {
		return input as {}
	}

	// the object containing the relevant fields
	const fields = rootType === '@root' ? artifact.input.fields : artifact.input.types[rootType]

	// if we are looking at a list
	if (Array.isArray(input)) {
		for (const val of input) {
			marshalInputs({ artifact, config, input: val, rootType })
		}
	} else {
		let inputMap = input as { [key: string]: unknown }

		// we're looking at an object, look at every key to anything to be marshaled
		for (const [fieldName, value] of Object.entries(input as {})) {
			// look up the type for the field
			const type = fields[fieldName]
			// if we don't have type information for this field, just use it directly
			// it's most likely a non-custom scalars or enums
			if (!type) {
				continue
			}

			// is the type something that requires marshaling
			if (config.scalars?.[type]?.marshal) {
				inputMap[fieldName] = config.scalars[type].marshal(value)
				continue
			}

			// if the type doesn't require marshaling and isn't a referenced type
			if (isScalar(config, type)) {
				continue
			}

			// we ran into an object type that should be referenced by the artifact
			marshalInputs({ artifact, config, input: value, rootType: type })
		}
	}

	// we're done marshaling content
	return input as {}
}

export function unmarshalSelection(
	config: Config,
	selection: SubscriptionSelection,
	data: unknown
): {} | null | undefined {
	if (data === null || typeof data === 'undefined') {
		return data
	}

	// if we are looking at a list
	if (Array.isArray(data)) {
		// unmarshal every entry in the list
		for (const val of data) {
			unmarshalSelection(config, selection, val)
		}
	}
	// we are looking at an object
	else {
		const dataMap = data as { [key: string]: unknown }

		for (const [fieldName, value] of Object.entries(dataMap)) {
			// look up the type for the field
			const { type, fields } = selection[fieldName]
			// if we don't have type information for this field, just use it directly
			// it's most likely a non-custom scalars or enums
			if (!type) {
				continue
			}

			// is the type something that requires marshaling
			if (config.scalars?.[type]?.marshal) {
				dataMap[fieldName] = config.scalars[type].unmarshal(value)
				continue
			}

			// if the type doesn't require marshaling and isn't a referenced type
			// if the type is a scalar that doesn't require marshaling
			if (isScalar(config, type)) {
				continue
			}

			// if there is a subselectoin
			if (fields) {
				// walk down
				unmarshalSelection(config, fields, value)
			}
		}
	}

	return data as {}
}

// we can't use config.isScalar because that would require bundling in houdini-common
export function isScalar(config: Config, type: string) {
	return ['String', 'Boolean', 'Float', 'ID', 'Int']
		.concat(Object.keys(config.scalars || {}))
		.includes(type)
}
