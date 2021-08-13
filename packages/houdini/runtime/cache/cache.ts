// external imports
import type { Config } from 'houdini-common'
// local imports
import {
	Maybe,
	GraphQLValue,
	SubscriptionSelection,
	SubscriptionSpec,
	GraphQLObject,
} from '../types'
import { Record } from './record'
import { ListHandler } from './list'
import { isScalar } from '../scalars'

// this class implements the cache that drives houdini queries
export class Cache {
	_config: Config
	constructor(config: Config) {
		this._config = config

		// the cache should always be disabled on the server
		try {
			this._disabled = typeof window === 'undefined'
		} catch {
			this._disabled = true
		}
	}

	// the map from entity id to record
	private _data: Map<string | undefined, Record> = new Map()
	// associate list names with the handler that wraps the list
	private _lists: Map<string, Map<string, ListHandler>> = new Map()

	// for server-side requests we need to be able to flag the cache as disabled so we dont write to it
	private _disabled = false

	// save the response in the local store and notify any subscribers
	write({
		selection,
		data,
		variables = {},
		parent = rootID,
		applyUpdates = false,
	}: {
		selection: SubscriptionSelection
		data: { [key: string]: GraphQLValue }
		variables?: {}
		parent?: string
		applyUpdates?: boolean
	}) {
		// if the cache is disabled we shouldn't write anything
		if (this._disabled) {
			return
		}

		// keep track of all of the subscription specs we have to write to because of this operation
		const specs: SubscriptionSpec[] = []

		// recursively walk down the payload and update the store. calls to update atomic fields
		// will build up different specs of subscriptions that need to be run against the current state
		this._write({
			rootID: parent,
			selection,
			recordID: parent,
			data,
			variables,
			specs,
			applyUpdates,
		})

		// the same spec will likely need to be updated multiple times, create the unique list by using the set
		// function's identity
		const uniqueSpecs: SubscriptionSpec[] = []
		const assignedSets: SubscriptionSpec['set'][] = []
		for (const spec of specs) {
			// if we haven't added the set yet
			if (!assignedSets.includes(spec.set)) {
				uniqueSpecs.push(spec)
				assignedSets.push(spec.set)
			}
		}

		// compute new values for every spec that needs to be run
		this.notifySubscribers(uniqueSpecs, variables)
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

	idFields(type: string): string[] {
		return ['id']
	}

	subscribe(spec: SubscriptionSpec, variables: {} = {}) {
		// find the root record
		let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root()
		if (!rootRecord) {
			throw new Error('Could not find root of subscription')
		}

		// walk down the selection and register any subscribers
		this.addSubscribers(rootRecord, spec, spec.selection, variables)
	}

	unsubscribe(spec: SubscriptionSpec, variables: {} = {}) {
		// find the root record
		let rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root()
		// if there's no root, there's nothing to unsubscribe from
		if (!rootRecord) {
			return
		}

		// walk down the selection and remove any subscribers from the list
		this.removeSubscribers(rootRecord, spec, spec.selection, variables)
	}

	// get the list handler associated by name
	list(name: string, id?: string): ListHandler {
		// make sure that the handler exists
		const handler = this._lists.get(name)?.get(id || rootID)
		if (!handler) {
			throw new Error(
				`Cannot find list with name: ${name} under parent: ${id}. ` +
					'Is it possible that the query is not mounted?'
			)
		}

		// return the handler
		return handler
	}

	// remove the record from every list we know of and the cache itself
	delete(type: string, id: string, variables: {} = {}): boolean {
		const record = this.record(id)

		// remove any related subscriptions
		record.removeAllSubscribers()

		// look at every list we know of with the matching type
		for (const parentMap of this._lists.values()) {
			for (const handler of parentMap.values()) {
				// only consider the list if it holds the matching type
				if (handler.listType !== type) {
					continue
				}

				// remove the id from the list
				handler.removeID(id, variables)
			}
		}

		// remove the entry from the cache
		return this.deleteID(id)
	}

	// grab the record specified by {id}.
	// note: this is hidden behind the adapter because it will make entries in the
	// cache that might not play by the correct garbage keeping rules. "advanced users only"
	private record(id: string | undefined): Record {
		// if we haven't seen the record before add an entry in the store
		if (!this._data.has(id)) {
			this._data.set(id, new Record(this, id || ''))
		}

		// write the field value
		return this._data.get(id) as Record
	}

	get internal(): CacheProxy {
		return {
			notifySubscribers: this.notifySubscribers.bind(this),
			insertSubscribers: this.insertSubscribers.bind(this),
			unsubscribeSelection: this.unsubscribeSelection.bind(this),
			evaluateKey: this.evaluateKey.bind(this),
			record: this.record.bind(this),
			getRecord: this.getRecord.bind(this),
			getData: this.getData.bind(this),
			deleteID: this.deleteID.bind(this),
			computeID: this.computeID.bind(this),
			isDataAvailable: this.isDataAvailable.bind(this),
		}
	}

	private computeID(type: string, data: { [key: string]: GraphQLValue }) {
		return data.id
	}

	private root(): Record {
		return this.record(rootID)
	}

	// walk down the spec
	private getData(
		parent: Record | null | undefined,
		selection: SubscriptionSelection,
		variables: {}
	): GraphQLObject | null {
		// we could be asking for values of null
		if (parent === null || typeof parent === 'undefined') {
			return null
		}

		const target = {} as GraphQLObject

		// look at every field in the parentFields
		for (const [attributeName, { type, keyRaw, fields }] of Object.entries(selection)) {
			const key = this.evaluateKey(keyRaw, variables)

			// if the link points to a record then we just have to add it to the one
			const linkedRecord = parent.linkedRecord(key)
			// if the link points to a list
			const linkedList = parent.listLinks[key] || []

			// if the attribute links to a null value
			if (linkedRecord === null) {
				target[attributeName] = null
				continue
			}

			// the field could be an object
			if (linkedRecord && fields) {
				target[attributeName] = this.getData(linkedRecord, fields, variables)
				continue
			}
			// the field could be a list
			else if (fields) {
				// the linked list could be a deeply nested thing, we need to call getData for each record
				target[attributeName] = this.hydrateNestedList({ fields, variables, linkedList })
			}
			// we are looking at a scalar or some other type we don't recognize
			else {
				// look up the primitive value
				const val = parent.getField(key)

				// is the type a custom scalar with a specified unmarshal function
				if (this._config.scalars?.[type]?.unmarshal) {
					// pass the primitive value to the unmarshal function
					target[attributeName] = this._config.scalars[type].unmarshal(
						val
					) as GraphQLValue
				}
				// the field does not have an unmarshal function
				else {
					target[attributeName] = val
				}

				// we're done
				continue
			}
		}

		return target
	}

	private addSubscribers(
		rootRecord: Record,
		spec: SubscriptionSpec,
		selection: SubscriptionSelection,
		variables: { [key: string]: GraphQLValue }
	) {
		for (const { type, keyRaw, fields, list, filters } of Object.values(selection)) {
			const key = this.evaluateKey(keyRaw, variables)

			// add the subscriber to the field
			rootRecord.addSubscriber(keyRaw, key, spec)

			// if the field points to a link, we need to subscribe to any fields of that
			// linked record
			if (!isScalar(this._config, type)) {
				// if the link points to a record then we just have to add it to the one
				const linkedRecord = rootRecord.linkedRecord(key)
				let children = linkedRecord ? [linkedRecord] : rootRecord.flatLinkedList(key)

				// if this field is marked as a list, register it
				if (list && fields) {
					// if we haven't seen this list before
					if (!this._lists.has(list.name)) {
						this._lists.set(list.name, new Map())
					}

					// if we haven't already registered a handler to this list in the cache
					this._lists.get(list.name)?.set(
						spec.parentID || rootID,
						new ListHandler({
							name: list.name,
							connection: list.connection,
							parentID: spec.parentID,
							cache: this,
							record: rootRecord,
							listType: list.type,
							key,
							selection: fields,
							filters: Object.entries(filters || {}).reduce(
								(acc, [key, { kind, value }]) => {
									return {
										...acc,
										[key]: kind !== 'Variable' ? value : variables[value],
									}
								},
								{}
							),
						})
					)
				}

				// if we're not related to anything, we're done
				if (!children || !fields) {
					continue
				}

				// add the subscriber to every child
				for (const child of children) {
					// avoid null children
					if (!child) {
						continue
					}

					// make sure the children update this subscription
					this.addSubscribers(child, spec, fields, variables)
				}
			}
		}
	}

	private removeSubscribers(
		rootRecord: Record,
		spec: SubscriptionSpec,
		selection: SubscriptionSelection,
		variables: {}
	) {
		for (const { type, keyRaw, fields, list } of Object.values(selection)) {
			// figure out the actual key
			const key = this.evaluateKey(keyRaw, variables)

			// remove the subscriber to the field
			rootRecord.forgetSubscribers(spec)

			// if this field is marked as a list remove it from the cache
			if (list) {
				this._lists.delete(list.name)
			}

			// if the field points to a link, we need to remove any subscribers on any fields of that
			// linked record
			if (!isScalar(this._config, type)) {
				// if the link points to a record then we just have to remove it to the one
				const linkedRecord = rootRecord.linkedRecord(key)
				let children = linkedRecord ? [linkedRecord] : rootRecord.flatLinkedList(key)

				// if we still don't have anything to attach it to then there's no one to subscribe to
				if (!children || !fields) {
					continue
				}

				// remove the subscriber to every child
				for (const child of children) {
					// avoid null children
					if (!child) {
						continue
					}
					this.removeSubscribers(child, spec, fields, variables)
				}
			}
		}
	}

	private _write({
		rootID,
		selection,
		recordID,
		data,
		variables,
		specs,
		applyUpdates,
	}: {
		rootID: string // the ID that anchors any lists
		selection: SubscriptionSelection
		recordID: string // the ID of the record that we are updating in cache
		data: { [key: string]: GraphQLValue } | GraphQLValue[]
		variables: { [key: string]: GraphQLValue }
		specs: SubscriptionSpec[]
		applyUpdates: boolean
	}) {
		// the record we are storing information about this object
		const record = this.record(recordID)

		// look at ever field in the data
		for (const [field, value] of Object.entries(data)) {
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
			const key = this.evaluateKey(keyRaw, variables)

			// make sure we found the type info
			if (!linkedType) {
				throw new Error('could not find the field information for ' + field)
			}

			// if the value we are writing is null
			if (value === null) {
				// just treat it as a linked object
				record.writeRecordLink(key, null)
			}

			// the subscribers we need to register if we updated something
			const subscribers = record.getSubscribers(key)

			// if the value is an object, we know it points to a linked record
			if (value instanceof Object && !Array.isArray(value) && fields) {
				// if we ran into an interface
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

				// look up the current known link id
				const oldID = record.linkedRecordID(key)

				// figure out if this is an embedded object or a linked one by looking for all of the fields marked as
				// required to compute the entity's id
				const embedded =
					this.idFields(linkedType)?.filter(
						(field) => typeof value[field] === 'undefined'
					).length > 0

				// figure out the id of the new linked record
				const linkedID = !embedded ? this.id(linkedType, value) : `${recordID}.${key}`

				// if we are now linked to a new object we need to record the new value
				if (linkedID && oldID !== linkedID) {
					// record the updated value
					record.writeRecordLink(key, linkedID)

					// if there was a record we replaced
					if (oldID) {
						// we need to remove any subscribers that we just added to the specs
						this.record(oldID).forgetSubscribers(...subscribers)
					}

					// add every subscriber to the list of specs to change
					specs.push(...subscribers)
				}

				// only update the data if there is an id for the record
				if (linkedID) {
					// update the linked fields too
					this._write({
						rootID,
						selection: fields,
						recordID: linkedID,
						data: value,
						variables,
						specs,
						applyUpdates,
					})
				}
			}

			// the value could be a list
			else if (!isScalar(this._config, linkedType) && Array.isArray(value) && fields) {
				// look up the current known link id
				let oldIDs = [...(record.listLinks[this.evaluateKey(key, variables)] || [])]
				// find the empty nodes before we update the cache
				const emptyEdges = !update
					? []
					: oldIDs.filter((id) => {
							if (!id) {
								return false
							}

							// look up the edge record
							const edge = this.record(id as string)

							// if there is a cursor, keep it
							if (edge.fields['cursor']) {
								return false
							}

							// look up the linked node
							const node = edge.linkedRecord('node')
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
					specs,
					applyUpdates,
					recordID,
					key,
					linkedType,
					variables,
					fields,
				})

				// if we're supposed to apply this write as an update, we need to figure out how
				if (applyUpdates && update) {
					// it's possible that one of the ids in the field corresponds to an entry
					// that was added as part of a mutation operation on this list.
					// ideally we want to remove the old reference and leave the new one behind.
					// In order to pull this off, we have to rely on the fact that a mutation operation
					// doesn't leave a cursor behind. so we need to look at the old list of edges,
					// track if there's a cursor value, get their node id, and remove any node ids
					// that show up in the new list
					if (key === 'edges') {
						// build up a list of the ids found in the new list
						const newNodeIDs: string[] = []
						for (const id of newIDs) {
							if (!id) {
								continue
							}

							// look up the lined node record
							const node = this.record(id).linkedRecord('node')
							if (!node || !node.fields.__typename) {
								continue
							}

							newNodeIDs.push(node.id)
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
				for (const subscriber of subscribers) {
					// if either are true, add the subscriber to the list
					if (contentChanged) {
						specs.push(subscriber)
					}
				}

				// remove any subscribers we don't care about
				for (const lostID of oldIDs.filter(
					(id) => id !== null && !linkedIDs.includes(id)
				)) {
					const id = lostID as string
					for (const sub of subscribers) {
						if (!oldSubscribers[id]) {
							oldSubscribers[id] = new Set()
						}
						oldSubscribers[id].add(sub)
					}
				}

				for (const [id, subscribers] of Object.entries(oldSubscribers)) {
					this.record(id).forgetSubscribers(...subscribers)
				}

				// if there was a change in the list
				if (contentChanged || (oldIDs.length === 0 && newIDs.length === 0)) {
					// update the cached value
					record.writeListLink(key, linkedIDs)
				}
			}

			// the value is neither an object or a list so its a scalar
			else {
				// if the value is different
				if (JSON.stringify(value) !== JSON.stringify(record.getField(key))) {
					let newValue = value
					// if the value is an array, we might have to apply updates
					if (Array.isArray(value) && applyUpdates && update) {
						// if we have to prepend the new value on the old one
						if (update === 'append') {
							newValue = ((record.getField(key) as any[]) || []).concat(value)
						}
						// we might have to prepend our value onto the old one
						else if (update === 'prepend') {
							newValue = value.concat(record.getField(key) || [])
						}
					}
					// update the cached value
					record.writeField(key, newValue)

					// add every subscriber to the list of specs to change
					specs.push(...subscribers)
				}
			}

			// handle any operations relative to this node
			for (const operation of operations || []) {
				// turn the ID into something we can use
				let parentID: string | undefined
				if (operation.parentID) {
					// if its a normal scalar we can use the value directly
					if (operation.parentID.kind !== 'Variable') {
						parentID = operation.parentID.value
					} else {
						const id = variables[operation.parentID.value]
						if (typeof id !== 'string') {
							throw new Error('parentID value must be a string')
						}

						parentID = id
					}
				}

				// only insert an object into a list if we're adding an object with fields
				if (
					operation.action === 'insert' &&
					value instanceof Object &&
					!Array.isArray(value) &&
					fields &&
					operation.list
				) {
					this.list(operation.list, parentID)
						.when(operation.when)
						.addToList(fields, value, variables, operation.position || 'last')
				}

				// only insert an object into a list if we're adding an object with fields
				else if (
					operation.action === 'remove' &&
					value instanceof Object &&
					!Array.isArray(value) &&
					fields &&
					operation.list
				) {
					this.list(operation.list, parentID)
						.when(operation.when)
						.remove(value, variables)
				}

				// delete the operation if we have to
				else if (operation.action === 'delete' && operation.type) {
					if (typeof value !== 'string') {
						throw new Error('Cannot delete a record with a non-string ID')
					}

					const targetID = this.id(operation.type, value)
					if (!targetID) {
						continue
					}
					this.delete(operation.type, targetID, variables)
				}
			}
		}
	}

	private hydrateNestedList({
		fields,
		variables,
		linkedList,
	}: {
		fields: SubscriptionSelection
		variables: {}
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
			return this.getData(this.record(entry), fields, variables)
		})
	}

	private extractNestedListIDs({
		value,
		abstract,
		recordID,
		key,
		linkedType,
		fields,
		variables,
		applyUpdates,
		specs,
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
			this._write({
				rootID,
				selection: fields,
				recordID: linkedID,
				data: entryObj,
				variables,
				specs,
				applyUpdates,
			})

			newIDs.push(linkedID)
			nestedIDs[i] = linkedID
		}

		return { newIDs, nestedIDs }
	}

	// look up the information for a specific record
	private getRecord(id: string | null): Maybe<Record> {
		if (id === null) {
			return null
		}
		if (!id) {
			return
		}

		return this._data.get(id) || undefined
	}

	private notifySubscribers(specs: SubscriptionSpec[], variables: {} = {}) {
		for (const spec of specs) {
			// find the root record
			let rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root()
			if (!rootRecord) {
				throw new Error('Could not find root of subscription')
			}

			// trigger the update
			spec.set(this.getData(rootRecord, spec.selection, spec.variables?.()))
		}
	}

	private insertSubscribers(
		record: Record,
		selection: SubscriptionSelection,
		variables: {},
		...subscribers: SubscriptionSpec[]
	) {
		// look at every field in the selection and add the subscribers
		for (const { keyRaw, fields } of Object.values(selection)) {
			const key = this.evaluateKey(keyRaw, variables)

			// add the subscriber to the
			record.addSubscriber(keyRaw, key, ...subscribers)

			// if there are fields under this
			if (fields) {
				const linkedRecord = record.linkedRecord(key)
				// figure out who else needs subscribers
				const children = linkedRecord ? [linkedRecord] : record.flatLinkedList(key)
				for (const linkedRecord of children) {
					// avoid null records
					if (!linkedRecord) {
						continue
					}

					// insert the subscriber
					this.insertSubscribers(linkedRecord, fields, variables, ...subscribers)
				}
			}
		}
	}

	private unsubscribeSelection(
		record: Record,
		selection: SubscriptionSelection,
		variables: {},
		...subscribers: SubscriptionSpec['set'][]
	) {
		// look at every field in the selection and add the subscribers
		for (const { keyRaw, fields } of Object.values(selection)) {
			const key = this.evaluateKey(keyRaw, variables)
			// add the subscriber to the
			record.removeSubscribers([key], subscribers)

			// if there are fields under this
			if (fields) {
				// figure out who else needs subscribers
				const children =
					record.flatLinkedList(key).length > 0
						? record.flatLinkedList(key)
						: [record.linkedRecord(key)]

				for (const linkedRecord of children) {
					// avoid null records
					if (!linkedRecord) {
						continue
					}

					this.unsubscribeSelection(linkedRecord, fields, variables, ...subscribers)
				}
			}
		}
	}

	private evaluateKey(key: string, variables: { [key: string]: GraphQLValue } = {}): string {
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

	clear() {
		this._data = new Map()
		this._lists = new Map()
	}

	disable() {
		this._disabled = true
	}

	private deleteID(id: string): boolean {
		return this._data.delete(id)
	}

	private isDataAvailable(
		target: SubscriptionSelection,
		variables: {},
		parentID: string = rootID
	): boolean {
		// if the cache is disabled we dont have to look at anything else
		if (this._disabled) {
			return false
		}

		// look up the parent
		const record = this.record(parentID)

		// every field in the selection needs to be present
		for (const selection of Object.values(target)) {
			const fieldName = this.evaluateKey(selection.keyRaw, variables)

			// a single field could show up in the 3 places: as a field, a linked record, or a linked list

			// if the field has a value, we're good
			if (typeof record.getField(fieldName) !== 'undefined') {
				continue
			}
			// if the field has no value and there are no subselections and we dont have a value, we are missing data
			else if (!selection.fields) {
				return false
			}

			// if we have a null linked record
			const linked = record.linkedRecordID(fieldName)
			if (typeof linked !== 'undefined') {
				// if we have a null value we're good
				if (linked === null) {
					continue
				}

				// if we have a valid id, walk down
				return this.isDataAvailable(selection.fields!, variables, linked)
			}
			// look up the linked list
			const hasListLinks = record.listLinks[fieldName]
			if (hasListLinks) {
				// we need to look at every linked record
				for (const linkedRecord of record.flatLinkedList(fieldName)) {
					if (!linkedRecord) {
						continue
					}

					// if the linked record doesn't have the field then we are missing data
					if (!this.isDataAvailable(selection.fields!, variables, linkedRecord.id)) {
						return false
					}
				}
			}

			// if we dont have a linked record or linked list, we dont have the data
			if (typeof linked === 'undefined' && typeof hasListLinks === 'undefined') {
				return false
			}
		}

		// if we got this far, we have the information
		return true
	}
}

// the list of characters that make up a valid graphql variable name
const varChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789'

// in order to keep some methods on the class out of the public API we'll wrap some of the low-level or heavily caveated
// functions in a "proxy"
export type CacheProxy = {
	record: Cache['record']
	notifySubscribers: Cache['notifySubscribers']
	unsubscribeSelection: Cache['unsubscribeSelection']
	insertSubscribers: Cache['insertSubscribers']
	evaluateKey: Cache['evaluateKey']
	getRecord: Cache['getRecord']
	getData: Cache['getData']
	deleteID: Cache['deleteID']
	computeID: Cache['computeID']
	isDataAvailable: Cache['isDataAvailable']
}

// id that we should use to refer to things in root
export const rootID = '_ROOT_'

export type LinkedList<_Result = string> = (_Result | null | LinkedList<_Result>)[]
