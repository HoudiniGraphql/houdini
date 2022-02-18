// external imports
import type { Config } from 'houdini-common'
import { GraphQLObject, GraphQLValue, SubscriptionSelection, SubscriptionSpec } from '..'
import { List, ListManager } from './lists'
import { InMemoryStorage, Layer, LayerID } from './storage'
import { evaluateKey } from './stuff'
import { InMemorySubscriptions } from './subscription'

export class Cache {
	// the internal implementation for a lot of the cache's methods are moved into
	// a second class to avoid users from relying on unstable APIs. typescript's private
	// label accomplishes this but would not prevent someone using vanilla js
	_internal_unstable: CacheInternal

	constructor(config: Config) {
		this._internal_unstable = new CacheInternal({
			config,
			storage: new InMemoryStorage(),
			subscriptions: new InMemorySubscriptions(this),
			lists: new ListManager(),
			cache: this,
		})
	}

	// walk down the selection and save the values that we encounter.
	// any changes will notify subscribers. writing to an optimistic layer will resolve it
	write({
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
			? this._internal_unstable.storage.getLayer(layerID)
			: this._internal_unstable.storage.topLayer

		// write any values that we run into and get a list of subscribers
		const subscribers = this._internal_unstable.writeSelection({ ...args, layer })

		// the same spec will likely need to be updated multiple times, create the unique list by using the set
		// function's identity
		const notified: SubscriptionSpec['set'][] = []
		for (const spec of subscribers) {
			// if we haven't added the set yet
			if (!notified.includes(spec.set)) {
				notified.push(spec.set)

				// trigger the update
				spec.set(
					this._internal_unstable.getSelection({
						parent: spec.parentID || rootID,
						selection: spec.selection,
						variables: args.variables,
					})
				)
			}
		}

		// return the id to the caller so they can resolve the layer if it was optimistic
		return layer.id
	}

	// reconstruct an object with the fields/relations specified by a selection
	read(...args: Parameters<CacheInternal['getSelection']>) {
		return this._internal_unstable.getSelection(...args)
	}

	// register the provided callbacks with the fields specified by the selection
	subscribe(spec: SubscriptionSpec, variables: {} = {}) {
		// add the subscribers to every field in the specification
		return this._internal_unstable.subscriptions.add({
			parent: spec.parentID || rootID,
			spec,
			selection: spec.selection,
			variables,
		})
	}

	unsubscribe(spec: SubscriptionSpec, variables: {} = {}) {
		return this._internal_unstable.subscriptions.remove(
			spec.parentID || rootID,
			spec.selection,
			[spec],
			variables
		)
	}

	list(name: string, parentID?: string): List {
		const handler = this._internal_unstable.lists.get(name, parentID)
		if (!handler) {
			throw new Error(
				`Cannot find list with name: ${name}${
					parentID ? 'under parent ' + parentID : ''
				}. ` + 'Is it possible that the query is not mounted?'
			)
		}

		// return the handler
		return handler
	}

	delete(id: string) {
		// clean up any subscribers associated with the record before we destroy the actual values that will let us
		// walk down
		this._internal_unstable.subscriptions.removeAllSubscribers(id)

		// delete the record from the store
		this._internal_unstable.storage.delete(id)
	}
}

class CacheInternal {
	config: Config
	storage: InMemoryStorage
	subscriptions: InMemorySubscriptions
	lists: ListManager
	cache: Cache

	constructor({
		config,
		storage,
		subscriptions,
		lists,
		cache,
	}: {
		storage: InMemoryStorage
		config: Config
		subscriptions: InMemorySubscriptions
		lists: ListManager
		cache: Cache
	}) {
		this.config = config
		this.storage = storage
		this.subscriptions = subscriptions
		this.lists = lists
		this.cache = cache
	}

	writeSelection({
		data,
		selection,
		variables = {},
		root = rootID,
		parent = rootID,
		applyUpdates = false,
		layer,
		toNotify = [],
	}: {
		data: { [key: string]: GraphQLValue }
		selection: SubscriptionSelection
		variables?: { [key: string]: GraphQLValue }
		parent?: string
		root?: string
		layer: Layer
		toNotify?: SubscriptionSpec[]
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

			// the current set of subscribers
			const currentSubcribers = this.subscriptions.get(parent, key)

			// look up the previous value
			const { value: previousValue, displayLayers } = this.storage.get(parent, key)

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
					toNotify.push(...currentSubcribers)
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
				if (linkedID && displayLayer && linkChange) {
					// if there was an old subscriber we are forgotten
					if (previousValue && typeof previousValue === 'string') {
						this.subscriptions.remove(
							previousValue,
							fields,
							currentSubcribers,
							variables
						)
					}

					// we need to clear the subscriptions in the previous link
					// and add them to the new link
					toNotify.push(...currentSubcribers)
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
						toNotify,
						applyUpdates,
						layer,
					})
				}
			}
			// the field could point to a list of related objects
			else if (
				Array.isArray(value) &&
				// make typescript happy
				(typeof previousValue === 'undefined' || Array.isArray(previousValue))
			) {
				// make a shallow copy of the previous value we can  mutate
				let oldIDs = [...(previousValue || [])] as (string | null)[]

				// this field could be a connection (a list of references to edge objects).
				// inserts in this list might insert objects into the connection that
				// have already been added as part of a list operation. if that happens
				// we will need to filter out ids that refer to these fake-edges which
				// can be idenfitied as not having a cursor or node value
				const emptyEdges = !update
					? []
					: oldIDs.filter((id) => {
							if (!id) {
								return false
							}

							// look up the edge record
							const { value: cursorField } = this.storage.get(id, 'cursor')
							// if there is a value for the cursor, it needs to remain
							if (cursorField) {
								return false
							}

							// look up the node reference
							const { value: node } = this.storage.get(id, 'node')
							// if there one, keep the edge
							if (!node) {
								return false
							}

							// there is no cursor
							return true
					  })

				// if we are supposed to prepend or append and the mutation is enabled
				// the new list of IDs for this link will start with an existing value

				// build up the list of linked ids
				let linkedIDs: LinkedList = []

				// it could be a list of lists, in order to recreate the list of lists we need
				// we need to track two sets of IDs, the ids of the embedded records and
				// then the full structure of embedded lists. we'll use the flat list to add
				// and remove subscribers but we'll save the second list in the record so
				// we can recreate the structure
				const { newIDs, nestedIDs } = this.extractNestedListIDs({
					value,
					abstract: Boolean(isAbstract),
					specs: toNotify,
					applyUpdates,
					recordID: parent,
					key,
					linkedType,
					variables: variables,
					fields,
					layer,
				})

				// if we're supposed to apply this write as an update, we need to figure out how
				if (applyUpdates && update) {
					// if we are updating the edges field, we might need to do a little more than just
					// append/prepend to the field value. we might need to wrap the values in extra references
					if (key === 'edges') {
						// build up a list of the ids found in the new list
						const newNodeIDs: string[] = []
						for (const id of newIDs) {
							if (!id) {
								continue
							}

							// look up the lined node record
							const { value: node } = this.storage.get(id, 'node')
							// node should be a reference
							if (typeof node !== 'string') {
								continue
							}

							// if we dont have type information or a valid reference
							if (!node || !this.storage.get(node, '__typename')) {
								continue
							}

							newNodeIDs.push(node)
						}

						// only save a previous ID if the id shows up in the new list and was previously empty,
						oldIDs = oldIDs.filter(
							(id) => !(newIDs.includes(id as string) && emptyEdges.includes(id))
						)
					}
					// if we have to prepend it, do so
					if (update === 'prepend') {
						linkedIDs = newIDs.concat(oldIDs as (string | null)[])
					}
					// otherwise we might have to append it
					else if (update === 'append') {
						linkedIDs = oldIDs.concat(newIDs)
					}
					// if the update is a replace do the right thing
					else if (update === 'replace') {
						linkedIDs = newIDs
					}
				}
				// we're not supposed to apply this write as an update, just use the new value
				else {
					linkedIDs = nestedIDs as (string | null | (string | null)[])[]
				}

				// we have to notify the subscribers if a few things happen:
				// either the data changed (ie we got new content for the same list)
				// or we got content for a new list which could already be known. If we just look at
				// wether the IDs are the same, situations where we have old data that
				// is still valid would not be triggered
				const contentChanged = JSON.stringify(linkedIDs) !== JSON.stringify(oldIDs)

				let oldSubscribers: { [key: string]: Set<SubscriptionSpec> } = {}

				// we need to look at the last time we saw each subscriber to check if they need to be added to the spec
				for (const subscriber of currentSubcribers) {
					// if either are true, add the subscriber to the list
					if (contentChanged) {
						toNotify.push(subscriber)
					}
				}

				// any ids that don't show up in the new list need to have their subscribers wiped
				for (const lostID of oldIDs) {
					if (linkedIDs.includes(lostID) || !lostID) {
						continue
					}

					this.subscriptions.remove(lostID, fields, currentSubcribers, variables)
				}

				// if there was a change in the list
				if (contentChanged || (oldIDs.length === 0 && newIDs.length === 0)) {
					// update the cached value
					layer.writeField(parent, key, linkedIDs)
				}
			}
		}

		// return the list of subscribers that need to be updated because of this change
		return toNotify
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
			const { value } = this.storage.get(parent, key)

			// if the value is null
			if (value === null) {
				target[attributeName] = null
				continue
			}

			// if the field is a scalar
			if (!fields) {
				// is the type a custom scalar with a specified unmarshal function
				if (this.config.scalars?.[type]?.unmarshal) {
					// pass the primitive value to the unmarshal function
					target[attributeName] = this.config.scalars[type].unmarshal(
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

	extractNestedListIDs({
		value,
		abstract,
		recordID,
		key,
		linkedType,
		fields,
		variables,
		applyUpdates,
		specs,
		layer,
	}: {
		value: GraphQLValue[]
		recordID: string
		key: string
		linkedType: string
		abstract: boolean
		variables: {}
		specs: SubscriptionSpec[]
		applyUpdates: boolean
		fields: SubscriptionSelection
		layer: Layer
	}): { nestedIDs: LinkedList; newIDs: (string | null)[] } {
		// build up the two lists
		const nestedIDs: LinkedList = []
		const newIDs = []

		let id = 0

		for (const [i, entry] of value.entries()) {
			// if we found another list
			if (Array.isArray(entry)) {
				// compute the nested list of ids
				const inner = this.extractNestedListIDs({
					value: entry as GraphQLValue[],
					abstract,
					recordID,
					key,
					linkedType,
					fields,
					variables,
					applyUpdates,
					specs,
					layer,
				})

				// add the list of new ids to our list
				newIDs.push(...inner.newIDs)

				// and use the nested form in place of it
				nestedIDs[i] = inner.nestedIDs
				continue
			}
			// if the value is null just use that
			if (entry === null || typeof entry === 'undefined') {
				newIDs.push(null)
				nestedIDs[i] = null
				continue
			}

			// we know now that entry is an object
			const entryObj = entry as GraphQLObject

			// start off building up the embedded id
			let linkedID = `${recordID}.${key}[${id++}]`

			// figure out if this is an embedded list or a linked one by looking for all of the fields marked as
			// required to compute the entity's id
			const embedded =
				this.idFields(linkedType)?.filter(
					(field) => typeof (entry as GraphQLObject)[field] === 'undefined'
				).length > 0

			const typename = entryObj.__typename as string | undefined

			let innerType = linkedType
			// if we ran into an interface
			if (abstract) {
				// make sure we have a __typename field
				if (!typename) {
					throw new Error('Encountered interface type without __typename in the payload')
				}

				// we need to look at the __typename field in the response for the type
				innerType = typename as string
			}

			// build up an
			if (!embedded) {
				const id = this.id(innerType, entry as {})
				if (id) {
					linkedID = id
				} else {
					continue
				}
			}

			// if the field is marked for pagination and we are looking at edges, we need
			// to use the underlying node for the id because the embedded key will conflict
			// with entries in the previous loaded value.
			// NOTE: this approach might cause weird behavior of a node is loaded in the same
			// location in two different pages. In practice, nodes rarely show up in the same
			// connection so it might not be a problem.
			if (
				key === 'edges' &&
				entryObj.node &&
				(entryObj.node as { __typename: string }).__typename
			) {
				const node = entryObj.node as {}
				// @ts-ignore
				const typename = node.__typename
				let nodeID = this.id(typename, node)
				if (nodeID) {
					linkedID += '#' + nodeID
				}
			}

			// update the linked fields too
			this.writeSelection({
				root: rootID,
				selection: fields,
				parent: linkedID,
				data: entryObj,
				variables,
				toNotify: specs,
				applyUpdates,
				layer,
			})

			newIDs.push(linkedID)
			nestedIDs[i] = linkedID
		}

		return { newIDs, nestedIDs }
	}
}

// fields on the root of the data store are keyed with a fixed id
export const rootID = '_ROOT_'

export type LinkedList<_Result = string> = (_Result | null | LinkedList<_Result>)[]
