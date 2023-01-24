import { getCurrentConfig } from './config'
import type { ConfigFile } from './config'
import { getFieldsForType } from './selection'
import type {
	FragmentArtifact,
	MutationArtifact,
	QueryArtifact,
	SubscriptionArtifact,
	SubscriptionSelection,
} from './types'

export async function marshalSelection({
	selection,
	data,
}: {
	selection: SubscriptionSelection
	data: any
}): Promise<{} | null | undefined> {
	const config = getCurrentConfig()

	if (data === null || typeof data === 'undefined') {
		return data
	}

	// if we are looking at a list
	if (Array.isArray(data)) {
		// unmarshal every entry in the list
		return await Promise.all(data.map((val) => marshalSelection({ selection, data: val })))
	}

	const targetSelection = getFieldsForType(selection, data['__typename'] as string)

	// we're looking at an object, build it up from the current input
	return Object.fromEntries(
		await Promise.all(
			Object.entries(data as {}).map(async ([fieldName, value]) => {
				// look up the type for the field
				const { type, selection } = targetSelection[fieldName]
				// if we don't have type information for this field, just use it directly
				// it's most likely a non-custom scalars or enums
				if (!type) {
					return [fieldName, value]
				}

				// if there is a sub selection, walk down the selection
				if (selection) {
					return [fieldName, await marshalSelection({ selection, data: value })]
				}

				// is the type something that requires marshaling
				if (config!.scalars?.[type]) {
					const marshalFn = config!.scalars[type].marshal
					if (!marshalFn) {
						throw new Error(
							`scalar type ${type} is missing a \`marshal\` function. see https://github.com/AlecAivazis/houdini#%EF%B8%8Fcustom-scalars`
						)
					}
					if (Array.isArray(value)) {
						return [fieldName, value.map(marshalFn)]
					}
					return [fieldName, marshalFn(value)]
				}

				// if the type doesn't require marshaling and isn't a referenced type
				// then the type is a scalar that doesn't require marshaling
				return [fieldName, value]
			})
		)
	)
}

export function marshalInputs<T>({
	artifact,
	input,
	config,
	rootType = '@root',
}: {
	artifact: QueryArtifact | MutationArtifact | SubscriptionArtifact | FragmentArtifact
	input: unknown
	rootType?: string
	config: ConfigFile
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
		return input.map((val) => marshalInputs({ artifact, input: val, rootType, config }))
	}

	// we're looking at an object, build it up from the current input
	return Object.fromEntries(
		Object.entries(input as {}).map(([fieldName, value]) => {
			// look up the type for the field
			const type = fields?.[fieldName]
			// if we don't have type information for this field, just use it directly
			// it's most likely a non-custom scalars or enums
			if (!type) {
				return [fieldName, value]
			}

			// is the type something that requires marshaling
			const marshalFn = config.scalars?.[type]?.marshal
			if (marshalFn) {
				// if we are looking at a list of scalars
				if (Array.isArray(value)) {
					return [fieldName, value.map(marshalFn)]
				}
				return [fieldName, marshalFn(value)]
			}

			// if the type doesn't require marshaling and isn't a referenced type
			if (isScalar(config, type) || !artifact.input!.types[type]) {
				return [fieldName, value]
			}

			// we ran into an object type that should be referenced by the artifact
			return [fieldName, marshalInputs({ artifact, input: value, rootType: type, config })]
		})
	)
}

export function unmarshalSelection(
	config: ConfigFile,
	selection: SubscriptionSelection,
	data: any
): {} | null | undefined {
	if (data === null || typeof data === 'undefined') {
		return data
	}

	// if we are looking at a list
	if (Array.isArray(data)) {
		// unmarshal every entry in the list
		return data.map((val) => unmarshalSelection(config, selection, val))
	}

	const targetSelection = getFieldsForType(selection, data['__typename'] as string)

	// we're looking at an object, build it up from the current input
	return Object.fromEntries(
		Object.entries(data as {}).map(([fieldName, value]) => {
			// look up the type for the field
			const { type, selection } = targetSelection[fieldName]
			// if we don't have type information for this field, just use it directly
			// it's most likely a non-custom scalars or enums
			if (!type) {
				return [fieldName, value]
			}

			// if there is a sub selection, walk down the selection
			if (selection) {
				return [
					fieldName,
					// unmarshalSelection({ artifact, config, input: value, rootType: type }),
					unmarshalSelection(config, selection, value),
				]
			}
			if (value === null) {
				return [fieldName, value]
			}
			// is the type something that requires marshaling
			if (config.scalars?.[type]?.marshal) {
				const unmarshalFn = config.scalars[type]?.unmarshal
				if (!unmarshalFn) {
					throw new Error(
						`scalar type ${type} is missing an \`unmarshal\` function. see https://github.com/AlecAivazis/houdini#%EF%B8%8Fcustom-scalars`
					)
				}
				if (Array.isArray(value)) {
					return [fieldName, value.map(unmarshalFn)]
				}
				return [fieldName, unmarshalFn(value)]
			}

			// if the type doesn't require marshaling and isn't a referenced type
			// then the type is a scalar that doesn't require marshaling
			return [fieldName, value]
		})
	)
}

// we can't use config.isScalar because that would require bundling in ~/common
export function isScalar(config: ConfigFile, type: string) {
	return ['String', 'Boolean', 'Float', 'ID', 'Int']
		.concat(Object.keys(config.scalars || {}))
		.includes(type)
}

export function parseScalar(
	config: ConfigFile,
	type: string,
	value: string
): string | number | boolean {
	if (type === 'Boolean') {
		return value === 'true'
	}
	if (type === 'ID') {
		return value
	}
	if (type === 'String') {
		return value
	}
	if (type === 'Int') {
		return parseInt(value, 10)
	}
	if (type === 'Float') {
		return parseFloat(value)
	}

	// if we have a special parse function, use it
	if (config.scalars?.[type]?.marshal) {
		return config.scalars[type]?.marshal!(value)
	}

	// we dont recognize the type, just use the string value
	return value
}
