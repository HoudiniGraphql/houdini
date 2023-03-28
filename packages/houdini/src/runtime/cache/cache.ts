import { computeKey } from '../lib'
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
import { SchemaManager } from './schema'
import { StaleManager } from './staleManager'
import type { Layer, LayerID } from './storage'
import { InMemoryStorage } from './storage'
import { evaluateKey } from './stuff'
import { InMemorySubscriptions, type FieldSelection } from './subscription'

export class Cache {
	// the internal implementation for a lot of the cache's methods are moved into
	// a second class to avoid users from relying on unstable APIs. typescript's private
	// label accomplishes this but would not prevent someone using vanilla js
	_internal_unstable: CacheInternal

	constructor({ disabled, ...config }: ConfigFile & { disabled?: boolean } = {}) {
		this._internal_unstable = new CacheInternal({
			cache: this,
			storage: new InMemoryStorage(),
			subscriptions: new InMemorySubscriptions(this),
			lists: new ListManager(this, rootID),
			lifetimes: new GarbageCollector(this),
			staleManager: new StaleManager(this),
			schema: new SchemaManager(this),
			disabled: disabled ?? typeof globalThis.window === 'undefined',
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

		// the same spec will likely need to be updated multiple times, create the unique list by using the set
		// function's identity
		const notified: SubscriptionSpec['set'][] = []
		for (const spec of subscribers.concat(notifySubscribers)) {
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
	list(name: string, parentID?: string, allLists?: boolean): ListCollection {
		const handler = this._internal_unstable.lists.get(name, parentID, allLists)
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

	// remove the record from the cache's store and unsubscribe from it
	delete(id: string) {
		// clean up any subscribers associated with the record before we destroy the actual values that will let us
		// walk down
		this._internal_unstable.subscriptions.removeAllSubscribers(id)

		// make sure we remove the id from any lists that it appears in
		this._internal_unstable.lists.removeIDFromAllLists(id)

		// delete the record from the store
		this._internal_unstable.storage.delete(id)
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
}

class CacheInternal {
	// for server-side requests we need to be able to flag the cache as disabled so we dont write to it
	private _disabled = false

	_config?: ConfigFile
	storage: InMemoryStorage
	subscriptions: InMemorySubscriptions
	lists: ListManager
	cache: Cache
	lifetimes: GarbageCollector
	staleManager: StaleManager
	schema: SchemaManager

	constructor({
		storage,
		subscriptions,
		lists,
		cache,
		lifetimes,
		staleManager,
		schema,
		disabled,
		config,
	}: {
		storage: InMemoryStorage
		subscriptions: InMemorySubscriptions
		lists: ListManager
		cache: Cache
		lifetimes: GarbageCollector
		staleManager: StaleManager
		schema: SchemaManager
		disabled: boolean
		config?: ConfigFile
	}) {
		this.storage = storage
		this.subscriptions = subscriptions
		this.lists = lists
		this.cache = cache
		this.lifetimes = lifetimes
		this.staleManager = staleManager
		this.schema = schema
		this._config = config

		// the cache should always be disabled on the server, unless we're testing
		this._disabled = disabled
		try {
			if (process.env.HOUDINI_TEST === 'true') {
				this._disabled = false
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
		if (this._disabled) {
			return []
		}

		// which selection we need to walk down depends on the type of the data
		// if we dont have a matching abstract selection then we should just use the
		// normal field one

		// collect all of the fields that we need to write
		let targetSelection = getFieldsForType(selection, data['__typename'] as string | undefined)

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
				nullable,
			} = targetSelection[field]
			const key = evaluateKey(keyRaw, variables)

			// save the type information
			this.schema.setFieldType({
				parent,
				key: keyRaw,
				type: linkedType,
				nullable,
				link: !!fieldSelection,
			})

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

				// figure out if this is an embedded object or a linked one by looking for all of the fields marked as
				// required to compute the entity's id
				const embedded =
					this.idFields(linkedType)?.filter(
						(field) => typeof value[field] === 'undefined'
					).length > 0

				// figure out the new target of the object link
				let linkedID: string | null = null
				if (value !== null) {
					linkedID = !embedded ? this.id(linkedType, value) : `${parent}.${key}`
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
				(typeof previousValue === 'undefined' || Array.isArray(previousValue))
			) {
				// make a shallow copy of the previous value we can  mutate
				let oldIDs = [...(previousValue || [])] as (string | null)[]

				// this field could be a connection (a list of references to edge objects).
				// inserts in this list might insert objects into the connection that
				// have already been added as part of a list operation. if that happens
				// we will need to filter out ids that refer to these fake-edges which
				// can be idenfitied as not having a cursor or node value
				const emptyEdges = !updates
					? []
					: oldIDs.map((id) => {
							if (!id) {
								return ''
							}

							// look up the edge record
							const { value: cursorField } = this.storage.get(id, 'cursor')
							// if there is a value for the cursor, it needs to remain
							if (cursorField) {
								return ''
							}

							// look up the node reference
							const { value: node } = this.storage.get(id, 'node')
							// if there one, keep the edge
							if (!node) {
								return ''
							}

							// there is no cursor so the edge is empty
							return node
					  })

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

				// if we're supposed to apply this write as an update, we need to figure out how
				if (applyUpdates && updates) {
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
						oldIDs = oldIDs.filter((id) => {
							if (!id) {
								return true
							}

							// look up the node reference
							const { value } = this.storage.get(id, 'node')
							const node = value as string

							// if the id is being adding and is part of the empty edges, don't include it
							if (newNodeIDs.includes(node) && emptyEdges.includes(node)) {
								return false
							}

							// the id is not being replaced by a "real" version
							return true
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
				const contentChanged = !deepEquals(linkedIDs, oldIDs)

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
					// update the cached value
					layer.writeLink(parent, key, linkedIDs)
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
							.list(operation.list, parentID, operation.target === 'all')
							.when(operation.when)
							.addToList(
								fieldSelection,
								target,
								variables,
								operation.position || 'last',
								layer
							)
					}

					// remove object from list
					else if (
						operation.action === 'remove' &&
						target instanceof Object &&
						fieldSelection &&
						operation.list
					) {
						this.cache
							.list(operation.list, parentID, operation.target === 'all')
							.when(operation.when)
							.remove(target, variables)
					}

					// delete the target
					else if (operation.action === 'delete' && operation.type) {
						if (typeof target !== 'string') {
							throw new Error('Cannot delete a record with a non-string ID')
						}

						const targetID = this.id(operation.type, target)
						if (!targetID) {
							continue
						}
						this.cache.delete(targetID)
					}

					// the toggle operation
					else if (
						operation.action === 'toggle' &&
						target instanceof Object &&
						fieldSelection &&
						operation.list
					) {
						this.cache
							.list(operation.list, parentID, operation.target === 'all')
							.when(operation.when)
							.toggleElement({
								selection: fieldSelection,
								data: target,
								variables,
								where: operation.position || 'last',
								layer,
							})
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
	}: {
		selection: SubscriptionSelection
		parent?: string
		variables?: {}
		stepsFromConnection?: number | null
		ignoreMasking?: boolean
	}): { data: GraphQLObject | null; partial: boolean; stale: boolean; hasData: boolean } {
		// we could be asking for values of null
		if (parent === null) {
			return { data: null, partial: false, stale: false, hasData: true }
		}

		const target = {} as GraphQLObject
		if (selection.fragments) {
			target[fragmentKey] = Object.fromEntries(
				Object.entries(selection.fragments).map(([key, value]) => [
					key,
					{
						parent,
						variables: evaluateFragmentVariables(value, variables ?? {}),
					},
				])
			)
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
		let targetSelection = getFieldsForType(selection, typename)

		// look at every field in the parentFields
		for (const [
			attributeName,
			{ type, keyRaw, selection: fieldSelection, nullable, list, visible, directives },
		] of Object.entries(targetSelection)) {
			// skip masked fields when reading values
			if (!visible && !ignoreMasking) {
				continue
			}

			// some directives like @skip and @include prevent the value from being in the
			// selection
			const includeDirective = directives?.find((d) => {
				return d.name === 'include'
			})
			if (includeDirective) {
				// if the `if` argument evaluates to false, skip the field
				if (!evaluateFragmentVariables(includeDirective.arguments, variables ?? {})['if']) {
					continue
				}
			}
			const skipDirective = directives?.find((d) => {
				return d.name === 'skip'
			})
			if (skipDirective) {
				// if the `if` argument evaluates to false, skip the field
				if (evaluateFragmentVariables(skipDirective.arguments, variables ?? {})['if']) {
					continue
				}
			}

			const key = evaluateKey(keyRaw, variables)

			// look up the value in our store
			const { value } = this.storage.get(parent, key)

			// If we have an explicite null, that mean that it's stale and the we should do a network call
			const dt_field = this.staleManager.getFieldTime(parent, key)
			if (dt_field === null) {
				stale = true
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

			// if we dont have a value to return, use null (we check for non-null fields at the end)
			// ignore embedded cursors, they will get handled with the other scalars
			if (typeof value === 'undefined' || value === null) {
				// set the value to null
				target[attributeName] = null

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
					target[attributeName] = fnUnmarshal(value) as GraphQLValue
				}
				// the field does not have an unmarshal function
				else {
					target[attributeName] = value
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
				})

				// save the hydrated list
				target[attributeName] = listValue.data

				// the linked value could have partial results
				if (listValue.partial) {
					partial = true
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
				})

				// save the object value
				target[attributeName] = objectFields.data

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

			// regardless of how the field was processed, if we got a null value assigned
			// and the field is not nullable, we need to cascade up
			if (target[attributeName] === null && !nullable && !embeddedCursor) {
				cascadeNull = true
			}
		}

		return {
			data: cascadeNull ? null : target,
			// our value is considered true if there is some data but not everything
			// has a full value
			partial: hasData && partial,
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
		const id = typeof data === 'string' ? data : this.computeID(type, data)
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

	hydrateNestedList({
		fields,
		variables,
		linkedList,
		stepsFromConnection,
		ignoreMasking,
	}: {
		fields: SubscriptionSelection
		variables?: {}
		linkedList: NestedList
		stepsFromConnection: number | null
		ignoreMasking: boolean
	}): { data: NestedList<GraphQLValue>; partial: boolean; stale: boolean; hasData: boolean } {
		// the linked list could be a deeply nested thing, we need to call getData for each record
		// we can't mutate the lists because that would change the id references in the listLinks map
		// to the corresponding record. can't have that now, can we?
		const result: NestedList<GraphQLValue> = []
		let partialData = false
		let stale = false
		let hasValues = false

		for (const entry of linkedList) {
			// if the entry is an array, keep going
			if (Array.isArray(entry)) {
				const nestedValue = this.hydrateNestedList({
					fields,
					variables,
					linkedList: entry,
					stepsFromConnection,
					ignoreMasking,
				})
				result.push(nestedValue.data)
				if (nestedValue.partial) {
					partialData = true
				}
				continue
			}

			// the entry could be null
			if (entry === null) {
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
			})

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

			// figure out if this is an embedded list or a linked one by looking for all of the fields marked as
			// required to compute the entity's id
			const embedded =
				this.idFields(linkedType)?.filter(
					(field) => typeof (entry as GraphQLObject)[field] === 'undefined'
				).length > 0

			let innerType = linkedType

			const typename = entryObj.__typename as string | undefined
			if (typename) {
				innerType = typename
				// make sure we have a __typename field if we have an abstract value
			} else if (abstract) {
				throw new Error('Encountered interface type without __typename in the payload')
			}

			// if this isn't an embedded reference, use the entry's id in the link list
			if (!embedded) {
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

export function evaluateFragmentVariables(variables: ValueMap, args: GraphQLObject) {
	return Object.fromEntries(
		Object.entries(variables).map(([key, value]) => [key, fragmentVariableValue(value, args)])
	)
}

function fragmentVariableValue(value: ValueNode, args: GraphQLObject): GraphQLValue {
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
		return value.values.map((value) => fragmentVariableValue(value, args))
	}

	if (value.kind === 'ObjectValue') {
		return value.fields.reduce(
			(obj, field) => ({
				...obj,
				[field.name.value]: fragmentVariableValue(field.value, args),
			}),
			{}
		)
	}
}

// fields on the root of the data store are keyed with a fixed id
export const rootID = '_ROOT_'
