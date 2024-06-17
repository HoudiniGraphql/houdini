import { getFieldsForType } from '../../lib'
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
// can put the corresponding chain into a pending state. A doucment can also contain multiple
// keys in its response so we to keep track of the query path in our data where we encounter the key.
//
// So, we have 2 different mappings we need to track:
// a mapping from optimistic key to the list of callbacks that need to be notified
// a mapping of invocation id and path to the generated optimistic key
// NOTE: we need 2 different indexes so even though ^ could be merged into a single map.
//       since we need to know if an input is a generated key and if a path is a generated key

export type CallbackMap = Record<string, Array<(newID: any) => void>>
export type KeyMap = Record<number, Record<string, keyof CallbackMap>>

export const optimisticKeys =
	(
		callbackCache: CallbackMap = {},
		keyCache: KeyMap = {},
		invocationCounter: number = 0
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
						mutationID: newCtx.stuff.mutationID,
					})

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
					const newKeys = extractResponseKeys(
						value.data ?? {},
						keyCache,
						ctx.stuff.mutationID
					)

					// notify any dependent chains
					for (const [key, newID] of Object.entries(newKeys)) {
						// invoke each callback
						callbackCache[newID].forEach((cb) => cb(key))

						// clean up the caches since we're done with this key
						delete callbackCache[newID]
						delete keyCache[ctx.stuff.mutationID]
					}
				}

				// we're done
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
		const pathSoFar = `${args.path ?? ''}.${field}`

		// if this field is marked as an optimistic key, add it to the obj
		if (optimisticKey) {
			// TODO: be smarter about this. we should generate the correct type for the key
			const keyValue = new Date().getTime().toString()
			newKeys.push(keyValue)
			args.response[field] = keyValue

			args.callbackStore[keyValue] = []
			args.keyStore[args.mutationID] = {
				[pathSoFar]: keyValue,
			}
		}
		const value = args.response[field]

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

	return args.response
}

function extractInputKeys(
	obj: GraphQLObject,
	store: CallbackMap,
	found: Record<string, string | null> = {}
) {
	for (const [key, value] of Object.entries(obj)) {
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
	response: GraphQLObject,
	keyMap: KeyMap,
	mutationID: number,
	result: Record<string, string> = {},
	path: string = ''
): Record<string, string> {
	for (const [key, value] of Object.entries(response)) {
		const pathSoFar = `${path ?? ''}.${key}`

		if (typeof value === 'string' && keyMap[mutationID][pathSoFar]) {
			result[value] = keyMap[mutationID][pathSoFar]
		}

		if (Array.isArray(value)) {
			for (const [index, item] of flattenList(value).entries()) {
				if (item && typeof item === 'object') {
					extractResponseKeys(
						item as GraphQLObject,
						keyMap,
						mutationID,
						result,
						`${pathSoFar}[${index}]`
					)
				}
			}
		} else if (value && typeof value === 'object') {
			extractResponseKeys(value, keyMap, mutationID, result, pathSoFar)
		}
	}

	return result
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
