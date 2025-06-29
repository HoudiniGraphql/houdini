import { computeKey, PendingValue } from '../lib'
import type { ConfigFile } from '../lib/config'
import { computeID, defaultConfigValues, keyFieldsForType, getCurrentConfig } from '../lib/config'
import { deepEquals } from '../lib/deepEquals'
import { flatten } from '../lib/flatten'
import { getFieldsForType } from '../lib/selection'
import type {
	GraphQLObject,
	GraphQLValue,
	NestedList,
	SubscriptionSelection,
	SubscriptionSpec,
	ValueMap,
	ValueNode,
} from '../lib/types'
import { fragmentKey } from '../lib/types'
import { GarbageCollector } from './gc'
import type { ListCollection } from './lists'
import { ListManager } from './lists'
import { StaleManager } from './staleManager'
import type { Layer, LayerID } from './storage'
import { InMemoryStorage } from './storage'
import { evaluateKey, rootID } from './stuff'
import { InMemorySubscriptions, type FieldSelection } from './subscription'

export class Cache {
	// the internal implementation for a lot of the cache's methods are moved into
	// a second class to avoid users from relying on unstable APIs. typescript's private
	// label accomplishes this but would not prevent someone using vanilla js
	_internal_unstable: CacheInternal

	constructor({
		disabled,
		componentCache,
		createComponent,
		...config
	}: ConfigFile & {
		disabled?: boolean
		componentCache?: Record<string, any>
		createComponent?: (comp: any, prop: Record<string, any>) => any
	} = {}) {
		this._internal_unstable = new CacheInternal({
			cache: this,
			storage: new InMemoryStorage(),
			subscriptions: new InMemorySubscriptions(this),
			lists: new ListManager(this, rootID),
			lifetimes: new GarbageCollector(this),
			staleManager: new StaleManager(this),
			disabled: disabled ?? typeof globalThis.window === 'undefined',
			componentCache,
			createComponent,
		})

		if (Object.keys(config).length > 0) {
			this.setConfig(defaultConfigValues(config))
		}
	}

	// walk down the selection and save the values that we encounter.
	// any changes will notify subscribers. writing to an optimistic layer will resolve it
	write({
		layer: layerID,
		notifySubscribers = [],
		...args
	}: {
		data: { [key: string]: GraphQLValue }
		selection: SubscriptionSelection
		variables?: {}
		parent?: string
		layer?: LayerID | null
		applyUpdates?: string[]
		notifySubscribers?: SubscriptionSpec[]
		forceNotify?: boolean
		forceStale?: boolean
	}): SubscriptionSpec[] {
		// find the correct layer
		const layer = layerID
			? this._internal_unstable.storage.getLayer(layerID)
			: this._internal_unstable.storage.topLayer

		// write any values that we run into and get a list of subscribers
		const subscribers = this._internal_unstable
			.writeSelection({ ...args, layer })
			.map((sub) => sub[0])

		this.#notifySubscribers(subscribers.concat(notifySubscribers))

		// return the id to the caller so they can resolve the layer if it was optimistic
		return subscribers
	}

	// reconstruct an object with the fields/relations specified by a selection
	read(...args: Parameters<CacheInternal['getSelection']>) {
		const { data, partial, stale, hasData } = this._internal_unstable.getSelection(...args)

		if (!hasData) {
			return { data: null, partial: false, stale: false }
		}

		return {
			data,
			partial,
			stale,
		}
	}

	// register the provided callbacks with the fields specified by the selection
	subscribe(spec: SubscriptionSpec, variables: {} = {}) {
		// if the cache is disabled, dont do anything
		if (this._internal_unstable.disabled) {
			return
		}

		// add the subscribers to every field in the specification
		return this._internal_unstable.subscriptions.add({
			parent: spec.parentID || rootID,
			spec,
			selection: spec.selection,
			variables,
		})
	}

	// stop listening to a particular subscription
	unsubscribe(spec: SubscriptionSpec, variables: {} = {}) {
		return this._internal_unstable.subscriptions.remove(
			spec.parentID || rootID,
			spec.selection,
			[spec],
			variables
		)
	}

	// return the list handler to mutate a named list in the cache
	list(
		name: string,
		parentID?: string,
		allLists?: boolean,
		skipMatches?: Set<string>
	): ListCollection {
		const handler = this._internal_unstable.lists.get(name, parentID, allLists, skipMatches)
		if (!handler) {
			throw new Error(
				`Cannot find list with name: ${name}${
					parentID ? ' under parent ' + parentID : ''
				}. ` + 'Is it possible that the query is not mounted?'
			)
		}

		// return the handler
		return handler
	}

	// when an optimistic key resolves, we might momentarily know the same record by different IDs
	registerKeyMap(source: string, mapped: string) {
		this._internal_unstable.storage.registerIDMapping(source, mapped)
		this._internal_unstable.subscriptions.copySubscribers(source, mapped)
	}

	// remove the record from the cache's store and unsubscribe from it
	delete(id: string, layer?: Layer) {
		const recordIDs = [this._internal_unstable.storage.idMaps[id], id].filter(
			Boolean
		) as string[]

		for (const recordID of recordIDs) {
			// clean up any subscribers associated with the record before we destroy the actual values that will let us
			// walk down
			this._internal_unstable.subscriptions.removeAllSubscribers(recordID)

			// make sure we remove the id from any lists that it appears in
			this._internal_unstable.lists.removeIDFromAllLists(recordID, layer)

			// delete the record from the store
			this._internal_unstable.storage.delete(recordID, layer)
		}
	}

	// set the cache's config
	setConfig(config: ConfigFile) {
		this._internal_unstable.setConfig(config)
	}

	markTypeStale(options?: { type: string; field?: string; when?: {} }): void {
		if (!options) {
			this._internal_unstable.staleManager.markAllStale()
		} else if (!options.field) {
			this._internal_unstable.staleManager.markTypeStale(options.type)
		} else {
			this._internal_unstable.staleManager.markTypeFieldStale(
				options.type,
				options.field,
				options.when
			)
		}
	}

	markRecordStale(id: string, options: { field?: string; when?: {} }) {
		if (options.field) {
			const key = computeKey({ field: options.field, args: options.when ?? {} })
			this._internal_unstable.staleManager.markFieldStale(id, key)
		} else {
			this._internal_unstable.staleManager.markRecordStale(id)
		}
	}

	getFieldTime(id: string, field: string) {
		return this._internal_unstable.staleManager.getFieldTime(id, field)
	}

	config(): ConfigFile {
		return this._internal_unstable.config
	}

	serialize() {
		return this._internal_unstable.storage.serialize()
	}

	hydrate(...args: Parameters<InMemoryStorage['hydrate']>) {
		return this._internal_unstable.storage.hydrate(...args)
	}

	clearLayer(layerID: Layer['id']) {
		// before we clear the layer we need to look at every field/link and see if it is
		// the display layer. If it is the display layer than we need to notify
		// any subscribers if the value changed after we are done clearing the layer
		// the comparison to the previous value has to happen _after_ we clear the layer
		// so that we can look at values before and after the clear (this took me too long to realize)

		// find the layer
		const layer = this._internal_unstable.storage.getLayer(layerID)
		if (!layer) {
			throw new Error('Cannot find layer with id: ' + layerID)
		}

		// build up the list of everything we need to notify because of the clear
		const toNotify: SubscriptionSpec[] = []

		// we need to iterate over every field/link in the layer, look at the displayed value
		// and see if the layer is the target
		const allFields: DisplaySummary[] = []
		for (const target of [layer.fields, layer.links]) {
			for (const [id, fields] of Object.entries(target)) {
				allFields.push(
					...Object.entries(fields).map(([field, value]) => ({ id, field, value }))
				)
			}
		}

		// look at every pair and build up a list of the fields that we are display layers on.
		const displayFields: DisplaySummary[] = []
		for (const pair of allFields) {
			// look up the current value
			const { displayLayers } = this._internal_unstable.storage.get(pair.id, pair.field)

			// if the target layer is not the display layer, ignore the field (no need to notify anyone)
			if (!displayLayers.includes(layerID)) {
				continue
			}

			displayFields.push(pair)
		}

		// before we clear, we need to consider operations. They come in 2 forms:
		// - on a specific field/id (list mutations)
		// - on just an id (record deletes)
		// if we identify a global delete, then we need to look at _every subscriber_ for that id
		for (const [id, operation] of Object.entries(layer.operations)) {
			// if this is a delete operation,
			if (operation.deleted) {
				// add every active field for the id that we deleted
				displayFields.push(
					...this._internal_unstable.subscriptions
						.activeFields(id)
						.map((field) => ({ id, field }))
				)
			}

			// if the operation is a list, we need to look up the specific field for the corresponding lists
			const fields = Object.keys(operation.fields ?? {})
			if (fields.length > 0) {
				displayFields.push(...fields.map((field) => ({ id, field })))
			}
		}

		// clear the layer
		layer.clear()

		// now we have to look at the display fields and compare their value with the current
		// if the value changed then we need to notify the subscribers
		for (const display of displayFields) {
			const { field, id } = display

			// always notify changes from list operations. only silence changes that
			// are specific values who didn't actually change.
			const notify =
				!('value' in display) ||
				this._internal_unstable.storage.get(id, field).value !== display.value

			// if the value changed then we need to notify the subscribers
			if (notify) {
				toNotify.push(
					...this._internal_unstable.subscriptions.get(id, field).map((sub) => sub[0])
				)
			}
		}

		this.#notifySubscribers(toNotify)
	}

	// reset the whole cache
	reset() {
		// Reset Subscriptions
		const subSpecs = this._internal_unstable.subscriptions.reset()

		// Reset StaleManager
		this._internal_unstable.staleManager.reset()

		// Reset GarbageCollector
		this._internal_unstable.lifetimes.reset()

		// Reset Lists
		this._internal_unstable.lists.reset()

		// Reset InMemory Storage
		this._internal_unstable.storage.reset()

		// Notify Subscribers
		this.#notifySubscribers(subSpecs)
	}

	#notifySubscribers(subs: SubscriptionSpec[]) {
		// if there's no one to notify, its a no-op
		if (subs.length === 0) {
			return
		}
		// the same spec will likely need to be updated multiple times, create the unique list by using the set
		// function's identity
		const notified: SubscriptionSpec['set'][] = []
		for (const spec of subs) {
			// if we haven't added the set yet
			if (!notified.includes(spec.set)) {
				notified.push(spec.set)
				// trigger the update
				spec.set(
					this._internal_unstable.getSelection({
						parent: spec.parentID || rootID,
						selection: spec.selection,
						variables: spec.variables?.() || {},
						ignoreMasking: false,
					}).data
				)
			}
		}
	}
}

class CacheInternal {
	// for server-side requests we need to be able to flag the cache as disabled so we dont write to it
	disabled = false

	_config?: ConfigFile
	storage: InMemoryStorage
	subscriptions: InMemorySubscriptions
	lists: ListManager
	cache: Cache
	lifetimes: GarbageCollector
	staleManager: StaleManager
	componentCache: Record<string, any>
	createComponent: (component: any, props: Record<string, any>) => any

	constructor({
		storage,
		subscriptions,
		lists,
		cache,
		lifetimes,
		staleManager,
		disabled,
		config,
		componentCache,
		createComponent,
	}: {
		storage: InMemoryStorage
		subscriptions: InMemorySubscriptions
		lists: ListManager
		cache: Cache
		lifetimes: GarbageCollector
		staleManager: StaleManager
		disabled: boolean
		config?: ConfigFile
		componentCache?: Record<string, any>
		createComponent: undefined | ((component: any, props: Record<string, any>) => any)
	}) {
		this.storage = storage
		this.subscriptions = subscriptions
		this.lists = lists
		this.cache = cache
		this.lifetimes = lifetimes
		this.staleManager = staleManager
		this._config = config
		this.componentCache = componentCache ?? {}
		this.createComponent = createComponent ?? (() => ({}))

		// the cache should always be disabled on the server, unless we're testing
		this.disabled = disabled
		try {
			if (process.env.HOUDINI_TEST === 'true') {
				this.disabled = false
			}
		} catch {
			// if process.env doesn't exist, that's okay just use the normal value
		}
	}

	get config(): ConfigFile {
		return this._config ?? getCurrentConfig()
	}

	setConfig(config: ConfigFile) {
		this._config = config
	}

	writeSelection({
		data,
		selection,
		variables = {},
		parent = rootID,
		applyUpdates,
		layer,
		toNotify = [],
		forceNotify,
		forceStale,
	}: {
		data: { [key: string]: GraphQLValue }
		selection: SubscriptionSelection
		variables?: { [key: string]: GraphQLValue }
		parent?: string
		root?: string
		layer: Layer
		toNotify?: FieldSelection[]
		applyUpdates?: string[]
		forceNotify?: boolean
		forceStale?: boolean
	}): FieldSelection[] {
		// if the cache is disabled, dont do anything
		if (this.disabled) {
			return []
		}

		// which selection we need to walk down depends on the type of the data
		// if we dont have a matching abstract selection then we should just use the
		// normal field one

		// collect all of the fields that we need to write
		let targetSelection = getFieldsForType(
			selection,
			data['__typename'] as string | undefined,
			false
		)

		// data is an object with fields that we need to write to the store
		for (const [field, value] of Object.entries(data)) {
			// grab the selection info we care about
			if (!selection || !targetSelection[field]) {
				continue
			}

			// look up the field in our schema
			let {
				type: linkedType,
				keyRaw,
				selection: fieldSelection,
				operations,
				abstract: isAbstract,
				updates,
			} = targetSelection[field]
			const key = evaluateKey(keyRaw, variables)

			// if there is a __typename field, then we should use that as the type
			if (
				value &&
				typeof value === 'object' &&
				'__typename' in value &&
				value['__typename']
			) {
				linkedType = value['__typename'] as string
			}

			// the current set of subscribers
			const currentSubscribers = this.subscriptions.get(parent, key)
			const specs = currentSubscribers.map((sub) => sub[0])

			// look up the previous value
			const { value: previousValue, displayLayers } = this.storage.get(parent, key)

			// if the layer we are updating is the top most layer for the field
			// then its value is "live". It is providing the current value and
			// subscribers need to know if the value changed
			const displayLayer = layer.isDisplayLayer(displayLayers)

			// if we are writing to the display layer we need to refresh the lifetime of the value
			if (displayLayer) {
				this.lifetimes.resetLifetime(parent, key)

				// update the stale status
				if (forceStale) {
					this.staleManager.markFieldStale(parent, key)
				} else {
					this.staleManager.setFieldTimeToNow(parent, key)
				}
			}

			// any scalar is defined as a field with no selection
			if (!fieldSelection) {
				// the value to write to the layer
				let newValue = value

				// if the value is an array, we might have to apply updates
				if (updates && applyUpdates && Array.isArray(value)) {
					// look every update we were told to apply
					for (const update of applyUpdates) {
						// make sure the field accepts the update we're about to check
						if (!updates.includes(update)) {
							continue
						}

						// if we have to prepend the new value on the old one
						if (update === 'append') {
							newValue = ((previousValue as any[]) || []).concat(value)
						}
						// we might have to prepend our value onto the old one
						else if (update === 'prepend') {
							newValue = value.concat(previousValue || [])
						}
					}
				}

				// we need to handle pageInfo's contents specially. For now, they have an
				// update tagged on them which we will interpret here to indicate if we want the new value
				// or the old one

				// in a prepend update we want to use the old values for endCursor and hasNextPage
				if (
					updates &&
					applyUpdates?.includes('prepend') &&
					['endCursor', 'hasNextPage'].includes(key)
				) {
					newValue = previousValue
				}

				// in an append update we want to use the old values for startCursor and hasPreviousPage
				else if (
					updates &&
					applyUpdates?.includes('append') &&
					['startCursor', 'hasPreviousPage'].includes(key)
				) {
					newValue = previousValue
				}

				// if the value changed on a layer that impacts the current latest value
				const valueChanged = !deepEquals(newValue, previousValue)

				if (displayLayer && (valueChanged || forceNotify)) {
					// we need to add the fields' subscribers to the set of callbacks
					// we need to invoke
					toNotify.push(...currentSubscribers)
				}

				// write value to the layer
				layer.writeField(parent, key, newValue)
			}
			// if we are writing `null` over a link
			else if (value === null) {
				// if the previous value was also null, there's nothing to do
				if (previousValue === null) {
					continue
				}

				const previousLinks = flatten<string>([previousValue as string | string[]])

				for (const link of previousLinks) {
					this.subscriptions.remove(link, fieldSelection, specs, variables)
				}

				layer.writeLink(parent, key, null)

				// add the list of subscribers for this field
				toNotify.push(...currentSubscribers)
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
				}

				// figure out the new target of the object link
				let linkedID: string | null = null
				if (value !== null) {
					// if the value is embedded then the id needs to be keyed by the field
					linkedID = !this.isEmbedded(linkedType, value)
						? this.id(linkedType, value)
						: `${parent}.${key}`
				}
				let linkChange = linkedID !== previousValue

				// write the link to the layer
				layer.writeLink(parent, key, linkedID)

				// if the link target of this field changed and it was responsible for the current subscription
				if (linkedID && displayLayer && (linkChange || forceNotify)) {
					// we need to clear the subscriptions in the previous link
					// and add them to the new link
					if (previousValue && typeof previousValue === 'string') {
						this.subscriptions.remove(previousValue, fieldSelection, specs, variables)
					}

					// copy the subscribers to the new value
					this.subscriptions.addMany({
						parent: linkedID,
						subscribers: currentSubscribers,
						variables,
						parentType: linkedType,
					})

					toNotify.push(...currentSubscribers)
				}

				// if the link target points to another record in the cache we need to walk down its
				// selection and update any values we run into
				if (linkedID) {
					this.writeSelection({
						selection: fieldSelection,
						parent: linkedID,
						data: value,
						variables,
						toNotify,
						applyUpdates,
						layer,
						forceNotify,
					})
				}
			}
			// the field could point to a list of related objects
			else if (
				Array.isArray(value) &&
				// make typescript happy
				(typeof previousValue === 'undefined' ||
					previousValue === null ||
					Array.isArray(previousValue))
			) {
				// this field could be a connection (a list of references to edge objects).
				// inserts in this list might insert objects into the connection that
				// have already been added as part of a list operation. if that happens
				// we will need to filter out ids that refer to these fake-edges which
				// can be idenfitied as not having a cursor or node value
				let oldIDs = [...(previousValue || [])] as (string | null)[]

				// if we are updating a list then we dont want to consider inserted values as coming from the cache
				if (updates?.includes('append') || updates?.includes('prepend')) {
					oldIDs = oldIDs.filter((id) => {
						// look through the available layers
						for (const layer of this.storage.data) {
							for (const operation of Object.values(layer.operations)) {
								// if the operation is a list and the id is in the list, then we know that this id
								// was inserted into the list and we should ignore it
								if (operation.fields?.[key])
									for (const listOperation of operation.fields[key]) {
										if ('id' in listOperation && listOperation.id === id) {
											return false
										}
									}
							}
						}
						return true
					})
				}

				// if we are supposed to prepend or append and the mutation is enabled
				// the new list of IDs for this link will start with an existing value

				// build up the list of linked ids
				let linkedIDs: NestedList = []

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
					variables,
					fields: fieldSelection,
					layer,
					forceNotify,
				})

				// we have to do something different if we are writing to an optimistic layer or not
				// if we aren't writing to an optimistic layer than we need to make sure that we aren't
				// adding any values that were previously only included because of an insert operation
				let action = () => {
					layer.writeLink(parent, key, linkedIDs)
				}

				// if we're supposed to apply this write as an update, we need to figure out how
				if (applyUpdates && updates) {
					// if we are updating the edges field, we might need to do a little more than just
					// append/prepend to the field value. we might need to wrap the values in extra references
					const filterIDs = (keep: (string | null)[], insert: (string | null)[]) => {
						const existingIDs = new Set<string>()
						for (const id of keep) {
							if (!id) {
								continue
							}

							// look up the node reference
							const { value: node } = this.storage.get(id, 'node')
							// if there one, keep the edge
							if (!node) {
								continue
							}

							const nodeID = this.storage.get(node as string, 'id')
							if (!nodeID) {
								continue
							}
							existingIDs.add(nodeID.value as string)
						}

						return insert.filter((id) => {
							if (!id) {
								return true
							}
							// look up the node reference
							const { value: node } = this.storage.get(id, 'node')
							// if there one, keep the edge
							if (!node) {
								return true
							}

							const nodeID = this.storage.get(node as string, 'id')
							if (!nodeID) {
								return true
							}

							return !existingIDs.has(nodeID.value as string)
						})
					}

					// look every update we were told to apply
					for (const update of applyUpdates) {
						// make sure the field accepts the update we're about to check
						if (update !== 'replace' && !updates.includes(update)) {
							continue
						}

						// if we have to prepend it, do so
						if (update === 'prepend') {
							linkedIDs = newIDs.concat(
								filterIDs(newIDs, oldIDs) as (string | null)[]
							)
							if (layer?.optimistic) {
								action = () => {
									for (const id of newIDs) {
										if (id) {
											layer.insert(parent, key, 'start', id)
										}
									}
								}
							}
						}
						// otherwise we might have to append it
						else if (update === 'append') {
							linkedIDs = filterIDs(newIDs, oldIDs).concat(newIDs)
							if (layer?.optimistic) {
								action = () => {
									for (const id of newIDs) {
										if (id) {
											layer.insert(parent, key, 'end', id)
										}
									}
								}
							}
						}
						// if the update is a replace do the right thing
						else if (update === 'replace') {
							linkedIDs = newIDs
						}
					}
				}
				// we're not supposed to apply this write as an update, just use the new value
				else {
					linkedIDs = nestedIDs
				}

				// we have to notify the subscribers if a few things happen:
				// either the data changed (ie we got new content for the same list)
				// or we got content for a new list which could already be known. If we just look at
				// whether the IDs are the same, situations where we have old data that
				// is still valid would not be triggered
				const contentChanged = !deepEquals(linkedIDs, oldIDs) || previousValue === null

				// we need to look at the last time we saw each subscriber to check if they need to be added to the spec
				if (contentChanged || forceNotify) {
					toNotify.push(...currentSubscribers)
				}

				// any ids that don't show up in the new list need to have their subscribers wiped
				for (const lostID of oldIDs) {
					if (linkedIDs.includes(lostID) || !lostID) {
						continue
					}

					this.subscriptions.remove(lostID, fieldSelection, specs, variables)
				}

				// if there was a change in the list
				if (contentChanged || (oldIDs.length === 0 && newIDs.length === 0)) {
					action()
				}

				// every new id that isn't a prevous relationship needs a new subscriber
				for (const id of newIDs.filter((id) => !oldIDs.includes(id))) {
					if (id == null) {
						continue
					}

					this.subscriptions.addMany({
						parent: id,
						subscribers: currentSubscribers,
						variables,
						parentType: linkedType,
					})
				}
			}

			// there could be multiple operations that refer to the same field entry in the cache
			// which would result in duplicate data. this is a useful pattern to ensure that the required
			// fields are included for both lists so we want to support it. we need to track the operation targets
			// we've already processed so we don't duplicate work
			const processedOperations = new Set<string>()

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

				// if the necessary list doesn't exist, don't do anything
				if (
					operation.list &&
					!this.lists.get(operation.list, parentID, operation.target === 'all')
				) {
					continue
				}

				// there could be a list of elements to perform the operation on
				const targets = Array.isArray(value) ? value : [value]
				for (const target of targets) {
					// insert an object into a list
					if (
						operation.action === 'insert' &&
						target instanceof Object &&
						fieldSelection &&
						operation.list
					) {
						this.cache
							.list(
								operation.list,
								parentID,
								operation.target === 'all',
								processedOperations
							)
							.when(operation.when)
							.addToList(
								fieldSelection,
								target,
								variables,
								operation.position || 'last',
								layer
							)
					}

					// the toggle operation
					else if (
						operation.action === 'toggle' &&
						target instanceof Object &&
						fieldSelection &&
						operation.list
					) {
						this.cache
							.list(
								operation.list,
								parentID,
								operation.target === 'all',
								processedOperations
							)
							.when(operation.when)
							.toggleElement({
								selection: fieldSelection,
								data: target,
								variables,
								where: operation.position || 'last',
								layer,
							})
					}

					// remove object from list
					else if (
						operation.action === 'remove' &&
						target instanceof Object &&
						fieldSelection &&
						operation.list
					) {
						this.cache
							.list(
								operation.list,
								parentID,
								operation.target === 'all',
								processedOperations
							)
							.when(operation.when)
							.remove(target, variables, layer)
					}

					// delete the target
					else if (operation.action === 'delete' && operation.type && target) {
						const targetID = this.id(operation.type, target)
						if (!targetID) {
							continue
						}

						toNotify.push(
							...this.subscriptions
								.getAll(targetID)
								.filter((sub) => sub[0].parentID !== targetID)
						)

						this.cache.delete(targetID, layer)
					}
				}

				if (operation.list) {
					// figure out the field referenced by the list
					const matchingLists = this.cache.list(
						operation.list,
						parentID,
						operation.target === 'all'
					)
					for (const list of matchingLists.lists) {
						processedOperations.add(list.fieldRef)
					}
				}
			}
		}

		return toNotify
	}

	// reconstruct an object defined by its selection
	getSelection({
		selection,
		parent = rootID,
		variables,
		stepsFromConnection = null,
		ignoreMasking,
		fullCheck = false,
		loading: generateLoading,
	}: {
		selection: SubscriptionSelection
		parent?: string
		variables?: {} | null
		stepsFromConnection?: number | null
		ignoreMasking?: boolean
		loading?: boolean
		// if this is true then we are ignoring masking and checking the full select
		// data. we will still return the masked value if we have it.
		fullCheck?: boolean
	}): {
		data: GraphQLObject | null
		partial: boolean
		stale: boolean
		hasData: boolean
	} {
		// we could be asking for values of null
		if (parent === null) {
			return { data: null, partial: false, stale: false, hasData: true }
		}

		const target = {} as GraphQLObject
		if (selection.fragments) {
			// this structure needs to be duplicated in defaultComponentField
			target[fragmentKey] = {
				loading: Boolean(generateLoading),
				values: Object.fromEntries(
					Object.entries(selection.fragments)
						// only include the fragments that are marked loading
						// if we are generating the loading state
						.filter(([, value]) => !generateLoading || value.loading)
						.map(([key, value]) => [
							key,
							{
								parent,
								variables: evaluateVariables(value.arguments, variables ?? {}),
							},
						])
				),
			}
		}

		// we need to track if we have a partial data set which means we have _something_ but not everything
		let hasData = !!selection.fragments
		// if we run into a single missing value we will flip this since it means we have a partial result
		let partial = false

		// if we get an empty value for a non-null field, we need to turn the whole object null
		// that happens after we process every field to determine if its a partial null
		let cascadeNull = false

		// Check if we have at least one stale data
		let stale = false

		// if we have abstract fields, grab the __typename and include them in the list
		const typename = this.storage.get(parent, '__typename').value as string
		// collect all of the fields that we need to write
		let targetSelection = getFieldsForType(selection, typename, !!generateLoading)

		// look at every field in the parentFields
		for (const [
			attributeName,
			{
				type,
				keyRaw,
				selection: fieldSelection,
				nullable,
				list,
				visible,
				directives,
				loading: fieldLoading,
				abstractHasRequired,
				component,
			},
		] of Object.entries(targetSelection)) {
			// skip masked fields when reading values
			if (!visible && !ignoreMasking && !fullCheck) {
				continue
			}

			// some directives like @skip and @include prevent the value from being in the
			// selection
			const includeDirective = directives?.find((d) => {
				return d.name === 'include'
			})
			if (includeDirective) {
				// if the `if` argument evaluates to false, skip the field
				if (!evaluateVariables(includeDirective.arguments, variables ?? {})['if']) {
					continue
				}
			}
			const skipDirective = directives?.find((d) => {
				return d.name === 'skip'
			})
			if (skipDirective) {
				// if the `if` argument evaluates to false, skip the field
				if (evaluateVariables(skipDirective.arguments, variables ?? {})['if']) {
					continue
				}
			}

			// we can't write to the target if we are masking the field
			// but in order to simplify the logic, we're still going to write to _something_
			const fieldTarget = visible || ignoreMasking ? target : {}

			const key = evaluateKey(keyRaw, variables)

			// if we are generating a loading state and this field is not meant to be included, skip it
			if (generateLoading && !fieldLoading) {
				continue
			}

			// if the field is a component then the storage system should return (and persist)
			// a componoent that gets the fragment's data
			const defaultValue = !component
				? undefined
				: defaultComponentField({
						cache: this.cache,
						component,
						variables,
						parent,
				  })

			// look up the value in our store
			let { value } = this.storage.get(parent, key, defaultValue)

			// If we have an explicite null, that mean that it's stale and the we should do a network call
			const dt_field = this.staleManager.getFieldTime(parent, key)
			if (dt_field === null) {
				stale = true
			}

			// a loading state has no real values
			if (generateLoading) {
				value = undefined
			}

			// in order to avoid falsey identifying the `cursor` field of a connection edge
			// as missing non-nullable data (and therefor cascading null to the response) we need to
			// count the number of steps since we saw a connection field and if we are at the
			// appropriate level and we run into a null cursor, we avoid the null cascade
			let nextStep = stepsFromConnection
			// if we are counting steps
			if (nextStep !== null) {
				// if we are too many steps passed the connection to care, reset the counter
				if (nextStep >= 2) {
					nextStep = null
				} else {
					nextStep += 1
				}
			}

			// if the field is marked as a connection, start the counter
			if (list?.connection) {
				nextStep = 0
			}

			// if we run into a null cursor that is inside of a connection then
			// we know its a generated value and should not force us to mark the whole parent as
			// null (prevent the null cascade) or be treated as partial data
			const embeddedCursor = key === 'cursor' && stepsFromConnection === 1

			// if we dont have a value, we know this result is going to be partial
			if (typeof value === 'undefined' && !embeddedCursor) {
				partial = true
			}

			// if we are generating a loading state and we're supposed to stop here, do so
			if (generateLoading && fieldLoading?.kind === 'value') {
				// @ts-ignore: we're violating the contract knowingly
				fieldTarget[attributeName] = PendingValue
				hasData = true
			}

			// if we dont have a value to return, use null (we check for non-null fields at the end)
			// ignore embedded cursors, they will get handled with the other scalars
			// NOTE: we don't care about a null value when generating the loading state
			// since we will turn lists into lists, objects into objects, etc.
			// the !generateLoading here makes sure that we treat loading undefined and normal undefined differently
			// we force all loading values to be undefined a few lines above so we never overwrite
			// the pending value here.
			else if ((!generateLoading && typeof value === 'undefined') || value === null) {
				// set the value to null
				fieldTarget[attributeName] = null

				// if we didn't just write undefined, there is officially some data in this object
				if (typeof value !== 'undefined') {
					hasData = true
				}
			}

			// if the field is a scalar
			else if (!fieldSelection) {
				// is the type a custom scalar with a specified unmarshal function
				const fnUnmarshal = this.config?.scalars?.[type]?.unmarshal
				if (fnUnmarshal) {
					// pass the primitive value to the unmarshal function
					// if value is an array of scalars, we need to unmarshal every single item individually.
					if (Array.isArray(value)) {
						fieldTarget[attributeName] = value.map(
							(v) => fnUnmarshal(v) as GraphQLValue
						)
					} else {
						fieldTarget[attributeName] = fnUnmarshal(value) as GraphQLValue
					}
				}
				// the field does not have an unmarshal function
				else {
					fieldTarget[attributeName] = value
				}

				hasData = true
			}

			// if the field is a list of records
			else if (Array.isArray(value)) {
				// the linked list could be a deeply nested thing, we need to call getData for each record
				const listValue = this.hydrateNestedList({
					fields: fieldSelection,
					variables,
					linkedList: value as NestedList,
					stepsFromConnection: nextStep,
					ignoreMasking: !!ignoreMasking,
					fullCheck,
					loading: generateLoading,
					nullable: !!nullable,
				})

				// save the hydrated list
				fieldTarget[attributeName] = listValue.data

				// the linked value could have partial results
				if (listValue.partial) {
					partial = true
				}

				if (listValue.cascadeNull) {
					cascadeNull = true
				}

				if (listValue.stale) {
					stale = true
				}

				if (listValue.hasData || value.length === 0) {
					hasData = true
				}
			}

			// otherwise the field is a linked object
			else {
				// look up the related object fields
				const objectFields = this.getSelection({
					parent: value as string,
					selection: fieldSelection,
					variables,
					stepsFromConnection: nextStep,
					ignoreMasking,
					fullCheck,
					loading: generateLoading,
				})
				// save the object value
				fieldTarget[attributeName] = objectFields.data

				// the linked value could have partial results
				if (objectFields.partial) {
					partial = true
				}

				if (objectFields.stale) {
					stale = true
				}

				if (objectFields.hasData) {
					hasData = true
				}
			}

			// if we are generating a loading value then we might need to wrap up the result
			if (generateLoading && fieldLoading?.list) {
				fieldTarget[attributeName] = wrapInLists(
					Array.from<GraphQLValue>({ length: fieldLoading.list.count }).fill(
						fieldTarget[attributeName]
					),
					fieldLoading.list.depth - 1
				)
			}

			// regardless of how the field was processed, if we got a null value assigned
			// and the field is not nullable, we need to cascade up
			if (fieldTarget[attributeName] === null && !nullable && !embeddedCursor) {
				// if we got a null value assigned and the field is not nullable, we need to cascade up
				// except when it's an abstract type with @required children - then we return a dummy object
				if (abstractHasRequired) {
					target[attributeName] = {
						__typename: "@required field missing; don't match this",
					}
				} else {
					cascadeNull = true
				}
			}
		}

		return {
			data: cascadeNull ? null : target,
			// our value is considered true if there is some data but not everything
			// has a full value
			partial: !generateLoading && hasData && partial,
			stale: hasData && stale,
			hasData,
		}
	}

	// returns the global id of the specified field (used to access the record in the cache)
	id(type: string, data: {} | null): string | null
	// this is like id but it trusts the value used for the id and just joins it with the
	// type to form the global id
	id(type: string, id: string): string | null
	id(type: string, data: any): string | null {
		// try to compute the id of the record
		const id = typeof data === 'object' ? this.computeID(type, data) : data
		if (!id) {
			return null
		}

		if (!type) {
			return id
		}

		return type + ':' + id
	}

	// the list of fields that we need in order to compute an objects id
	idFields(type: string): string[] {
		return keyFieldsForType(this.config, type)
	}

	computeID(type: string, data: any): string {
		return computeID(this.config, type, data)
	}

	// figure out if this is an embedded object or a linked one by looking for all of the fields marked as
	// required to compute the entity's id
	isEmbedded(linkedType: string, value: GraphQLObject) {
		const idFields = this.idFields(linkedType)
		return (
			idFields.length === 0 ||
			idFields.filter((field) => typeof value[field] === 'undefined').length > 0
		)
	}

	hydrateNestedList({
		fields,
		variables,
		linkedList,
		stepsFromConnection,
		ignoreMasking,
		fullCheck,
		loading,
		nullable,
	}: {
		fields: SubscriptionSelection
		nullable: boolean
		variables?: {} | null
		linkedList: NestedList
		stepsFromConnection: number | null
		ignoreMasking: boolean
		fullCheck?: boolean
		loading?: boolean
	}): {
		data: NestedList<GraphQLValue>
		partial: boolean
		stale: boolean
		hasData: boolean
		cascadeNull: boolean
	} {
		// the linked list could be a deeply nested thing, we need to call getData for each record
		// we can't mutate the lists because that would change the id references in the listLinks map
		// to the corresponding record. can't have that now, can we?
		const result: NestedList<GraphQLValue> = []
		let partialData = false
		let stale = false
		let hasValues = false
		let cascadeNull = false

		for (const entry of linkedList) {
			// if the entry is an array, keep going
			if (Array.isArray(entry)) {
				const nestedValue = this.hydrateNestedList({
					fields,
					nullable,
					variables,
					linkedList: entry,
					stepsFromConnection,
					ignoreMasking,
					fullCheck,
					loading,
				})
				result.push(nestedValue.data)
				if (nestedValue.partial) {
					partialData = true
				}
				if (nestedValue.cascadeNull) {
					cascadeNull = true
				}
				continue
			}

			// the entry could be null
			if (entry === null) {
				// if we don't allow nullable fields we have to cascade
				result.push(entry)
				continue
			}

			// look up the data for the record
			const {
				data,
				partial,
				stale: local_stale,
				hasData,
			} = this.getSelection({
				parent: entry,
				selection: fields,
				variables,
				stepsFromConnection,
				ignoreMasking,
				fullCheck,
				loading,
			})

			// if the value is null and we don't allow that we need to cascade
			if (data === null && !nullable) {
				cascadeNull = true
			}

			result.push(data)

			if (partial) {
				partialData = true
			}

			if (local_stale) {
				stale = true
			}

			if (hasData) {
				hasValues = true
			}
		}

		return {
			data: result,
			partial: partialData,
			stale,
			hasData: hasValues,
			cascadeNull,
		}
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
		forceNotify,
	}: {
		value: GraphQLValue[]
		recordID: string
		key: string
		linkedType: string
		abstract: boolean
		variables: {}
		specs: FieldSelection[]
		applyUpdates?: string[]
		fields: SubscriptionSelection
		layer: Layer
		forceNotify?: boolean
	}): { nestedIDs: NestedList; newIDs: (string | null)[] } {
		// build up the two lists
		const nestedIDs: NestedList = []
		const newIDs: (string | null)[] = []

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
					forceNotify,
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
			// @ts-ignore
			let linkedID = `${recordID}.${key}[${this.storage.nextRank}]`
			let innerType = linkedType

			const typename = entryObj.__typename as string | undefined
			if (typename) {
				innerType = typename
				// make sure we have a __typename field if we have an abstract value
			} else if (abstract) {
				throw new Error('Encountered interface type without __typename in the payload')
			}

			// if this isn't an embedded reference, use the entry's id in the link list
			if (!this.isEmbedded(linkedType, entry as GraphQLObject)) {
				const id = this.id(innerType, entry as {})
				if (id) {
					linkedID = id
				} else {
					continue
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
				forceNotify,
			})

			newIDs.push(linkedID)
			nestedIDs[i] = linkedID
		}

		return { newIDs, nestedIDs }
	}

	collectGarbage() {
		// increment the lifetimes of unused data
		this.lifetimes.tick()

		// if there is only one layer in the cache, clean up the data
		if (this.storage.layerCount === 1) {
			this.storage.topLayer.removeUndefinedFields()
		}
	}
}

export function evaluateVariables(variables: ValueMap, args: GraphQLObject) {
	return Object.fromEntries(
		Object.entries(variables).map(([key, value]) => [key, variableValue(value, args)])
	)
}

function wrapInLists<T>(target: T, count: number = 0): T | NestedList<T> {
	if (count === 0) {
		return target
	}
	return wrapInLists([target], count - 1)
}

export function variableValue(value: ValueNode, args: GraphQLObject): GraphQLValue {
	if (value.kind === 'StringValue') {
		return value.value
	}
	if (value.kind === 'BooleanValue') {
		return value.value
	}
	if (value.kind === 'EnumValue') {
		return value.value
	}
	if (value.kind === 'FloatValue') {
		return parseFloat(value.value)
	}
	if (value.kind === 'IntValue') {
		return parseInt(value.value, 10)
	}
	if (value.kind === 'NullValue') {
		return null
	}
	if (value.kind === 'Variable') {
		return args[value.name.value]
	}
	if (value.kind === 'ListValue') {
		return value.values.map((value) => variableValue(value, args))
	}

	if (value.kind === 'ObjectValue') {
		return value.fields.reduce(
			(obj, field) => ({
				...obj,
				[field.name.value]: variableValue(field.value, args),
			}),
			{}
		)
	}
}

type DisplaySummary = { id: string; field: string; value?: any }

export function fragmentReference({
	component,
	prop,
}: {
	component: { name: string }
	prop: string
}): any {
	return `${component.name}.${prop}`
}

export function defaultComponentField({
	cache,
	component,
	loading,
	variables,
	parent,
}: {
	cache: Cache
	component: Required<Required<SubscriptionSelection>['fields'][string]>['component']
	loading?: boolean
	variables: Record<string, GraphQLValue> | undefined | null
	parent: string
}) {
	return (props: any) => {
		// look up the component in the store
		const componentFn = cache._internal_unstable.componentCache[component.key]

		const args = evaluateVariables(component.variables ?? {}, variables ?? {})

		// return the instantiated component with the appropriate prop
		return cache._internal_unstable.createComponent(componentFn, {
			...props,
			[component.prop]: {
				[fragmentKey]: {
					loading,
					values: {
						[component.fragment]: {
							variables: args,
							parent,
						},
					},
				},
			},
		})
	}
}
