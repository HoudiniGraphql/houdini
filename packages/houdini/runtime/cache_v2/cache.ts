// external imports
import type { Config } from 'houdini-common'
import { GraphQLObject, GraphQLValue, SubscriptionSelection, SubscriptionSpec } from '..'
import { LinkedList } from '../cache/cache'
import { InMemoryStorage, Layer, LayerID } from './storage'

export class Cache {
	// the internal implementation for a lot of the cache's methods are moved into
	// a second class to avoid users from relying on unstable APIs. typescript's private
	// label accomplishes this but would not prevent someone using vanilla js
	_internal_unstable: CacheInternal

	constructor(config: Config) {
		this._internal_unstable = new CacheInternal({
			config,
			storage: new InMemoryStorage(),
		})
	}

	// walk down the selection and save the values that we encounter.
	// any changes will notify subscribers. writing to an optimistic layer will resolve it
	writeSelection({
		layer: layerID,
		...args
	}: {
		data: { [key: string]: GraphQLValue }
		selection: SubscriptionSelection
		variables?: {}
		parent?: string
		layer?: LayerID
		applyUpdates?: boolean
	}): LayerID {
		// find the correct layer
		const layer = layerID
			? this._internal_unstable._storage.getLayer(layerID)
			: this._internal_unstable._storage.createLayer()

		// write any values that we run into and get a list of subscribers
		const subscribers = this._internal_unstable.writeSelection({ ...args, layer })

		// return the id to the caller so they can resolve the layer if it was optimistic
		return layer.id
	}

	// reconstruct an object with the fields/related specified by a selection
	getSelection(...args: Parameters<CacheInternal['getSelection']>) {
		return this._internal_unstable.getSelection(...args)
	}
}

class CacheInternal {
	_config: Config
	_storage: InMemoryStorage

	constructor({ config, storage }: { storage: InMemoryStorage; config: Config }) {
		this._config = config
		this._storage = storage
	}

	writeSelection({
		data,
		selection,
		variables,
		root = rootID,
		parent = rootID,
		applyUpdates = false,
		layer,
		subscribersSoFar = [],
	}: {
		data: { [key: string]: GraphQLValue }
		selection: SubscriptionSelection
		variables?: {}
		parent?: string
		root?: string
		layer: Layer
		subscribersSoFar?: SubscriptionSpec[]
		applyUpdates?: boolean
	}): SubscriptionSpec[] {
		// data is an object with fields that we need to write to the store
		for (const [field, value] of Object.entries(data)) {
			// grab the selection info we care about
			if (!selection || !selection[field]) {
				throw new Error(
					'Could not find field listing in selection for ' +
						field +
						' @ ' +
						JSON.stringify(selection) +
						''
				)
			}

			// look up the field in our schema
			let {
				type: linkedType,
				keyRaw,
				fields,
				operations,
				abstract: isAbstract,
				update,
			} = selection[field]
			const key = evaluateKey(keyRaw, variables)

			// look up the previous value
			const [previousValue, displayLayers] = this._storage.get(parent, key)
			// if the layer we are updating is the top most layer for the field
			// then its value is "live", it is providing the current value and
			// subscribers need to know if the value changed
			const displayLayer = displayLayers.length === 0 || displayLayers.includes(layer.id)

			// any non-scalar is defined as a field with no selection
			if (!fields) {
				// the value to write to the layer
				let newValue = value

				// if the value is an array, we might have to apply updates
				if (Array.isArray(value) && applyUpdates && update) {
					// if we have to prepend the new value on the old one
					if (update === 'append') {
						newValue = ((previousValue as any[]) || []).concat(value)
					}
					// we might have to prepend our value onto the old one
					else if (update === 'prepend') {
						newValue = value.concat(previousValue || [])
					}
				}

				// if the value changed on a layer that impacts the current latest value
				const valueChanged = JSON.stringify(newValue) !== JSON.stringify(previousValue)
				if (valueChanged && displayLayer) {
					// we need to add the fields' subscribers to the set of callbacks
					// we need to invoke
				}

				// write value to the layer
				layer.writeField(parent, key, value)
			}
			// the field could point to a linked object
			else if (value instanceof Object && !Array.isArray(value)) {
				// the previous value is a string holding the id of the object to link to

				// if we ran into an interface we need to look at the __typename field
				if (isAbstract) {
					// make sure we have a __typename field
					if (!value.__typename) {
						throw new Error(
							'Encountered interface type without __typename in the payload'
						)
					}

					// we need to look at the __typename field in the response for the type
					linkedType = value.__typename as string
				}

				// figure out if this is an embedded object or a linked one by looking for all of the fields marked as
				// required to compute the entity's id
				const embedded =
					this.idFields(linkedType)?.filter(
						(field) => typeof value[field] === 'undefined'
					).length > 0

				// figure out the new target of the object link
				let linkedID = null
				if (value !== null) {
					linkedID = !embedded ? this.id(linkedType, value) : `${parent}.${key}`
				}
				let linkChange = linkedID !== previousValue

				// write the link to the layer
				layer.writeLink(parent, key, linkedID)

				// if the link target of this field changed and it was responsible for the current subscription
				if (displayLayer && linkChange) {
					// we need to clear the subscriptions in the previous link
					// and add them to the new link
				}

				// if the link target points to another record in the cache we need to walk down its
				// selection and update any values we run into
				if (linkedID) {
					this.writeSelection({
						root,
						selection: fields,
						parent: linkedID,
						data: value,
						variables,
						subscribersSoFar,
						applyUpdates,
						layer,
					})
				}
			}
			// the field could point to a list of related objects
			else if (Array.isArray(value)) {
			}
		}

		// return the list of subscribers that need to be updated because of this change
		return subscribersSoFar
	}

	// reconstruct an object defined by its selection
	getSelection({
		selection,
		parent = rootID,
		variables,
	}: {
		selection: SubscriptionSelection
		parent?: string
		variables?: {}
	}): GraphQLObject | null {
		// we could be asking for values of null
		if (parent === null) {
			return null
		}

		const target = {} as GraphQLObject

		// look at every field in the parentFields
		for (const [attributeName, { type, keyRaw, fields }] of Object.entries(selection)) {
			const key = evaluateKey(keyRaw, variables)

			// look up the value in our store
			const [value] = this._storage.get(parent, key)

			// if the value is null
			if (value === null) {
				target[attributeName] = null
				continue
			}

			// if the field is a scalar
			if (!fields) {
				// is the type a custom scalar with a specified unmarshal function
				if (this._config.scalars?.[type]?.unmarshal) {
					// pass the primitive value to the unmarshal function
					target[attributeName] = this._config.scalars[type].unmarshal(
						value
					) as GraphQLValue
				}
				// the field does not have an unmarshal function
				else {
					target[attributeName] = value
				}

				// we're done
				continue
			}
			// if the field is a list of records
			else if (Array.isArray(value)) {
				// the linked list could be a deeply nested thing, we need to call getData for each record
				target[attributeName] = this.hydrateNestedList({
					fields,
					variables,
					linkedList: value as LinkedList,
				})
			}
			// otherwise the field is an object
			else {
				// if we dont have a value, use null
				target[attributeName] = !value
					? null
					: this.getSelection({
							parent: value as string,
							selection: fields,
							variables,
					  })
				continue
			}
		}

		return target
	}

	hydrateNestedList({
		fields,
		variables,
		linkedList,
	}: {
		fields: SubscriptionSelection
		variables?: {}
		linkedList: LinkedList
	}): LinkedList<GraphQLValue> {
		// the linked list could be a deeply nested thing, we need to call getData for each record
		// we can't mutate the lists because that would change the id references in the listLinks map
		// to the corresponding record. can't have that now, can we?
		return linkedList.map((entry) => {
			// if the entry is an array, keep going
			if (Array.isArray(entry)) {
				return this.hydrateNestedList({ fields, variables, linkedList: entry })
			}

			// the entry could be null
			if (entry === null) {
				return entry
			}

			// look up the data for the record
			return this.getSelection({ parent: entry, selection: fields, variables })
		})
	}

	// returns the global id of the specified field (used to access the record in the cache)
	id(type: string, data: { id?: string } | null): string | null
	// this is like id but it trusts the value used for the id and just joins it with the
	// type to form the global id
	id(type: string, id: string): string | null
	id(type: string, data: any): string | null {
		// try to compute the id of the record
		const id = typeof data === 'string' ? data : this.computeID(type, data)
		if (!id) {
			return null
		}

		return type + ':' + id
	}

	// the list of fields that we need in order to compute an objects id
	idFields(type: string): string[] {
		return ['id']
	}

	computeID(type: string, data: { [key: string]: GraphQLValue }) {
		return data.id
	}
}

// given a raw key and a set of variables, generate the fully qualified key
export function evaluateKey(key: string, variables: { [key: string]: GraphQLValue } = {}): string {
	// accumulate the evaluated key
	let evaluated = ''
	// accumulate a variable name that we're evaluating
	let varName = ''
	// some state to track if we are "in" a string
	let inString = false

	for (const char of key) {
		// if we are building up a variable
		if (varName) {
			// if we are looking at a valid variable character
			if (varChars.includes(char)) {
				// add it to the variable name
				varName += char
				continue
			}
			// we are at the end of a variable name so we
			// need to clean up and add before continuing with the string

			// look up the variable and add the result (varName starts with a $)
			const value = variables[varName.slice(1)]

			evaluated += typeof value !== 'undefined' ? JSON.stringify(value) : 'undefined'

			// clear the variable name accumulator
			varName = ''
		}

		// if we are looking at the start of a variable
		if (char === '$' && !inString) {
			// start the accumulator
			varName = '$'

			// move along
			continue
		}

		// if we found a quote, invert the string state
		if (char === '"') {
			inString = !inString
		}

		// this isn't a special case, just add the letter to the value
		evaluated += char
	}

	return evaluated
}

// fields on the root of the data store are keyed with a fixed id
const rootID = '_ROOT_'

// the list of characters that make up a valid graphql variable name
const varChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789'
