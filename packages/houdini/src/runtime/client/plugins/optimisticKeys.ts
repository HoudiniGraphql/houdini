import type { Cache } from '../../cache/cache'
import configFile from '../../imports/config'
import { computeID, getFieldsForType, keyFieldsForType, marshalSelection } from '../../lib'
import type {
	GraphQLObject,
	NestedList,
	GraphQLValue,
	SubscriptionSelection,
} from '../../lib/types'
import { ArtifactKind } from '../../lib/types'
import type { ClientPlugin } from '../documentStore'

// This plugin is responsible for coordinating requests that have optimistic keys.
// When a mutation contains optimistically generated keys as inputs, we need to block
// the request pipeline until we have a true value for the key. This means that we need
// a way to keep track of the pending keys and then notify other request chains.
//
// The major constraint here is that a document could be invoked multiple times, each of which
// can put the corresponding chain into a pending state. A document can also contain multiple
// keys in its response so we need to keep track of the query path in our data where we encounter the key.
//
// Therefore, we have 2 different mappings we need to track:
// a mapping from optimistic key to the list of callbacks that need to be notified
// a mapping of invocation id and path to the generated optimistic key
// NOTE: we need 2 different indexes so even though ^ could be merged into a single map.
//       since we need to know if an input is a generated key and if a path is a generated key

export type CallbackMap = Record<string | number, Array<(newID: any) => void>>
export type KeyMap = Record<number, Record<string, keyof CallbackMap>>
type OptimisticObjectIDMap = Record<number, Record<string, string>>

const keys: KeyMap = {}
const callbacks: CallbackMap = {}
const objectIDMap: OptimisticObjectIDMap = {}

export const optimisticKeys =
	(
		cache: Cache,
		callbackCache: CallbackMap = callbacks,
		keyCache: KeyMap = keys,
		objectIDs: OptimisticObjectIDMap = objectIDMap,
		invocationCounter: number = 1
	): ClientPlugin =>
	() => {
		return {
			async start(ctx, { next }) {
				// the optimistic response gets passed in the context's stuff bag
				const optimisticResponse = ctx.stuff.optimisticResponse

				const newCtx = { ...ctx }

				// if the request has an optimistic response with optimistic keys embedded inside, we need to
				// add them to the response and register the values in our global state (only on the client)
				if (
					optimisticResponse &&
					ctx.artifact.kind === ArtifactKind.Mutation &&
					ctx.artifact.optimisticKeys
				) {
					newCtx.stuff.mutationID = invocationCounter++

					// add the keys to the response
					addKeysToResponse({
						selection: ctx.artifact.selection,
						response: optimisticResponse,
						callbackStore: callbackCache,
						keyStore: keyCache,
						objectIDs,
						mutationID: newCtx.stuff.mutationID,
					})

					// use the updated optimistic response for the rest of the chain
					newCtx.stuff.optimisticResponse = optimisticResponse
				}

				// make sure we write to the correct layer in the cache
				next(newCtx)
			},
			// if a request has variables that contain an optimistic key we need to block the
			// request before it is sent to the server
			beforeNetwork(ctx, { next }) {
				// if there are no optimistic keys, just move onto the next step
				if (Object.keys(keyCache).length === 0) {
					return next(ctx)
				}

				// look through the outgoing variables for ones that we have flagged as optimistic
				const pendingVariables: Record<string, string | null> = extractInputKeys(
					ctx.variables ?? {},
					callbackCache
				)

				// if there aren't any pending variables in the query, just move along
				if (Object.keys(pendingVariables).length === 0) {
					return next(ctx)
				}

				// we need to register a callback with each pending variable
				for (const key of Object.keys(pendingVariables)) {
					callbackCache[key].push((newID) => {
						pendingVariables[key] = newID

						// if that was the last variable that we needed to wait for, we can move on
						if (Object.values(pendingVariables).every((value) => value !== null)) {
							// add the optimistic keys back into the input variables
							next({
								...ctx,
								variables: replaceKeyWithVariable(
									{ ...ctx.variables },
									pendingVariables as Record<string, string>
								),
							})
						}
					})
				}
			},
			afterNetwork(ctx, { value, resolve }) {
				// if the artifact contained optimistic keys we need to extract them from the response
				// and notify any dependent chains
				if (
					ctx.artifact.kind === ArtifactKind.Mutation &&
					ctx.artifact.optimisticKeys &&
					typeof ctx.stuff.mutationID !== 'undefined'
				) {
					// look for any values in the response that correspond to values in the keyCache
					extractResponseKeys(
						cache,
						value.data ?? {},
						ctx.artifact.selection,
						keyCache,
						ctx.stuff.mutationID,
						{
							onNewKey: (optimisticValue, realValue) => {
								callbackCache[optimisticValue].forEach((cb) => {
									cb(realValue)
								})

								// clean up the caches since we're done with this key
								delete callbackCache[optimisticValue]
							},
							onIDChange: (optimisticValue, realValue) =>
								cache.registerKeyMap(optimisticValue, realValue),
						}
					)
				}

				// we're done
				resolve(ctx)
			},

			end(ctx, { resolve }) {
				if (typeof ctx.stuff.mutationID !== 'undefined') {
					delete keyCache[ctx.stuff.mutationID]
					delete objectIDs[ctx.stuff.mutationID]
				}

				resolve(ctx)
			},
		}
	}

function addKeysToResponse(args: {
	selection: SubscriptionSelection
	response: GraphQLObject
	callbackStore: CallbackMap
	keyStore: KeyMap
	type?: string
	path?: string
	mutationID: number
	objectIDs: OptimisticObjectIDMap
}): any {
	// we need to walk the selection and inject the optimistic keys into the response
	// collect all of the fields that we need to write
	let targetSelection = getFieldsForType(
		args.selection,
		args.response['__typename'] as string | undefined,
		false
	)
	const newKeys = []

	// data is an object with fields that we need to write to the store
	for (const [field, { type, selection: fieldSelection, optimisticKey }] of Object.entries(
		targetSelection
	)) {
		const value = args.response[field]
		const pathSoFar = `${args.path ?? ''}.${field}`

		// if this field is marked as an optimistic key, add it to the obj
		if (optimisticKey) {
			// figure out the value we should use for the optimistic key
			let keyValue

			// if there is a value already in the response then we should use that
			if (value) {
				// marshal the value into something we can use for an id
				const { marshaled } = marshalSelection({
					data: { marshaled: value },
					selection: {
						fields: {
							value: {
								type,
								keyRaw: 'value',
							},
						},
					},
				}) as { marshaled: string }

				// use the marshaled value as the key
				keyValue = marshaled
			}
			// if the field isn't present in the optimistic payload then we need to come up
			// with our own value for the key based on the type
			else {
				keyValue = generateKey(type)
			}

			// we need to populate the various stores that we use to track the keys
			newKeys.push(keyValue)
			args.response[field] = keyValue
			args.callbackStore[keyValue] = []
			args.keyStore[args.mutationID] = {
				[pathSoFar]: keyValue,
			}
		}

		// keep walking down the selection
		if (fieldSelection) {
			if (Array.isArray(value)) {
				for (const [index, item] of flattenList(value).entries()) {
					if (item && typeof item === 'object' && !Array.isArray(item)) {
						addKeysToResponse({
							...args,
							selection: fieldSelection,
							response: item,
							type,
							path: `${pathSoFar}[${index}]`,
						})
					}
				}
			} else if (value && typeof value == 'object') {
				addKeysToResponse({
					...args,
					selection: fieldSelection,
					response: value,
					type,
					path: pathSoFar,
				})
			}
		}
	}

	// if there were optimistic keys added to the response, we need to
	// track the ID holding the new value
	if (newKeys.length > 0) {
		const objID = `${args.type}:${computeID(configFile, args.type ?? '', args.response)}`
		for (const key of newKeys) {
			args.objectIDs[args.mutationID] = {
				...args.objectIDs[args.mutationID],
				[key]: objID,
			}
		}
	}

	return args.response
}

function extractInputKeys(
	obj: GraphQLObject,
	store: CallbackMap,
	found: Record<string, string | null> = {}
) {
	for (const value of Object.values(obj)) {
		if (typeof value === 'string' && store[value]) {
			found[value] = null
		}

		if (Array.isArray(value)) {
			for (const item of flattenList(value)) {
				if (item && typeof item === 'object') {
					extractInputKeys(item as GraphQLObject, store, found)
				}
			}
		} else if (value && typeof value === 'object') {
			extractInputKeys(value, store, found)
		}
	}

	return found
}

function extractResponseKeys(
	cache: Cache,
	response: GraphQLObject,
	selection: SubscriptionSelection,
	keyMap: KeyMap,
	mutationID: number,
	events: {
		onNewKey: (optimisticValue: string | number, realValue: string | number) => void
		onIDChange: (optimisticValue: string | number, realValue: string | number) => void
	},
	objectIDs: OptimisticObjectIDMap = objectIDMap,
	path: string = '',
	type: string = ''
) {
	// collect all of the fields that we need to write
	let targetSelection = getFieldsForType(
		selection,
		response['__typename'] as string | undefined,
		false
	)

	let optimisticID: string | null = null

	// data is an object with fields that we need to write to the store
	for (const [field, value] of Object.entries(response)) {
		// if the path corresponds to an optimistic key
		const pathSoFar = `${path ?? ''}.${field}`

		if (typeof value === 'string' && keyMap[mutationID][pathSoFar]) {
			const newKey = keyMap[mutationID][pathSoFar]
			// notify the listeners that the key has changed
			events.onNewKey(newKey, value)

			// grab the optimistic ID referenced by the path
			optimisticID = objectIDs[mutationID][newKey]
		}

		// grab the selection info we care about
		if (!selection || !targetSelection[field]) {
			continue
		}

		// look up the field in our schema
		let { type, selection: fieldSelection } = targetSelection[field]

		// walk down lists in the response
		if (Array.isArray(value)) {
			for (const [index, item] of flattenList(value).entries()) {
				if (item && typeof item === 'object' && fieldSelection) {
					extractResponseKeys(
						cache,
						item as GraphQLObject,
						fieldSelection,
						keyMap,
						mutationID,
						events,
						objectIDs,
						`${pathSoFar}[${index}]`,
						type
					)
				}
			}
		}
		// walk down objects in the response
		else if (value && typeof value === 'object' && fieldSelection) {
			extractResponseKeys(
				cache,
				value,
				fieldSelection,
				keyMap,
				mutationID,
				events,
				objectIDs,
				pathSoFar,
				type
			)
		}
	}

	// if we found an optimistic ID in the previous step
	if (optimisticID) {
		// once we're done walking down, we can compute the id
		const id = computeID(configFile, type, response)

		// if the id has changed, we need to tell the cache that the two ids are the same
		events.onIDChange(`${type}:${id}`, optimisticID)

		// we need to write new values for the key fields in the cache
		// that are owned by the old key
		cache.write({
			selection: {
				fields: Object.fromEntries(
					keyFieldsForType(configFile, type).map((key) => [
						key,
						{
							type: 'scalar',
							keyRaw: key,
						},
					])
				),
			},
			parent: optimisticID,
			data: response,
		})
	}
}

function flattenList(source: NestedList<GraphQLValue>): Array<GraphQLValue> {
	const result: Array<GraphQLValue> = []
	const left = [...source]
	while (left.length > 0) {
		const head = left.shift()
		if (Array.isArray(head)) {
			left.push(...head)
		} else {
			result.push(head)
		}
	}

	return result
}

function replaceKeyWithVariable(
	variables: GraphQLObject,
	keys: Record<string, string>
): GraphQLObject {
	for (const [key, value] of Object.entries(variables)) {
		if (typeof value === 'string' && keys[value]) {
			variables[key] = keys[value]
		}

		if (Array.isArray(value)) {
			for (const item of flattenList(value)) {
				if (item && typeof item === 'object') {
					replaceKeyWithVariable(item as GraphQLObject, keys)
				}
			}
		} else if (value && typeof value === 'object') {
			replaceKeyWithVariable(value, keys)
		}
	}

	return variables
}

function generateKey(type: string) {
	if (type === 'Int') {
		return new Date().getTime()
	}

	if (type === 'String') {
		return new Date().getTime().toString()
	}

	if (type === 'ID') {
		return new Date().getTime().toString()
	}

	throw new Error(
		`unsupported type for optimistic key: ${type}. Please provide a value in your mutation arguments.`
	)
}
