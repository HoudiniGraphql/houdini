import { SubscriptionSpec, SubscriptionSelection } from '../types'
import { evaluateKey, flattenList } from './stuff'
import { Cache, LinkedList } from './cache'
import { GraphQLValue } from '..'

// manage the subscriptions
export class InMemorySubscriptions {
	private cache: Cache

	constructor(cache: Cache) {
		this.cache = cache
	}

	private subscribers: { [id: string]: { [fieldName: string]: SubscriptionSpec[] } } = {}
	private referenceCounts: {
		[id: string]: { [fieldName: string]: Map<SubscriptionSpec['set'], number> }
	} = {}
	private keyVersions: { [key: string]: Set<string> } = {}

	add({
		parent,
		spec,
		selection,
		variables,
	}: {
		parent: string
		spec: SubscriptionSpec
		selection: SubscriptionSelection
		variables: { [key: string]: GraphQLValue }
	}) {
		for (const { keyRaw, fields, list, filters } of Object.values(selection)) {
			const key = evaluateKey(keyRaw, variables)

			// add the subscriber to the field
			this.addFieldSubscription(parent, key, spec)

			// if the field points to a link, we need to subscribe to any fields of that
			// linked record
			if (fields) {
				// if the link points to a record then we just have to add it to the one
				const { value: linkedRecord } = this.cache._internal_unstable.storage.get(
					parent,
					key
				)
				let children = !Array.isArray(linkedRecord)
					? [linkedRecord]
					: flattenList(linkedRecord)

				// if this field is marked as a list, register it. this will overwrite existing list handlers
				// so that they can get up to date filters
				if (list && fields) {
					this.cache._internal_unstable.lists.set({
						name: list.name,
						connection: list.connection,
						parentID: spec.parentID,
						cache: this.cache,
						recordID: parent,
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
					this.add({
						parent: child as string,
						spec,
						selection: fields,
						variables,
					})
				}
			}
		}
	}

	addFieldSubscription(id: string, field: string, spec: SubscriptionSpec) {
		// if we haven't seen the id or field before, create a list we can add to
		if (!this.subscribers[id]) {
			this.subscribers[id] = {}
		}
		if (!this.subscribers[id][field]) {
			this.subscribers[id][field] = []
		}

		// if this is the first time we've seen the raw key
		if (!this.keyVersions[field]) {
			this.keyVersions[field] = new Set()
		}

		// add this version of the key if we need to
		this.keyVersions[field].add(field)

		if (!this.subscribers[id][field].map(({ set }) => set).includes(spec.set)) {
			this.subscribers[id][field].push(spec)
		}

		// if this is the first time we've seen this field
		if (!this.referenceCounts[id]) {
			this.referenceCounts[id] = {}
		}
		if (!this.referenceCounts[id][field]) {
			this.referenceCounts[id][field] = new Map()
		}
		const counts = this.referenceCounts[id][field]

		// we're going to increment the current value by one
		counts.set(spec.set, (counts.get(spec.set) || 0) + 1)

		// reset the lifetime for the field
		this.cache._internal_unstable.lifetimes.resetLifetime(id, field)
	}

	// this is different from add because of the treatment of lists
	addMany({
		parent,
		selection,
		variables,
		subscribers,
	}: {
		parent: string
		selection: SubscriptionSelection
		variables: {}
		subscribers: SubscriptionSpec[]
	}) {
		// look at every field in the selection and add the subscribers
		for (const { keyRaw, fields } of Object.values(selection)) {
			const key = evaluateKey(keyRaw, variables)

			// add the subscriber to the
			for (const spec of subscribers) {
				this.addFieldSubscription(parent, key, spec)
			}

			// if there are fields under this
			if (fields) {
				const { value: link } = this.cache._internal_unstable.storage.get(parent, key)
				// figure out who else needs subscribers
				const children = !Array.isArray(link)
					? ([link] as string[])
					: flattenList(link as string[])
				for (const linkedRecord of children) {
					// avoid null records
					if (!linkedRecord) {
						continue
					}

					// insert the subscriber
					this.addMany({
						parent: linkedRecord,
						selection: fields,
						variables,
						subscribers,
					})
				}
			}
		}
	}

	get(id: string, field: string): SubscriptionSpec[] {
		return this.subscribers[id]?.[field] || []
	}

	remove(
		id: string,
		fields: SubscriptionSelection,
		targets: SubscriptionSpec[],
		variables: {},
		visited: string[] = []
	) {
		visited.push(id)

		// walk down to every record we know about
		const linkedIDs: [string, SubscriptionSelection][] = []

		// look at the fields for ones corresponding to links
		for (const selection of Object.values(fields)) {
			const key = evaluateKey(selection.keyRaw, variables)

			// remove the subscribers for the field
			this.removeSubscribers(id, key, targets)

			// if this field is marked as a list remove it from the cache
			if (selection.list) {
				// TODO: no parent?!
				this.cache._internal_unstable.lists.remove(selection.list.name)
			}

			// if there is no subselection it doesn't point to a link, move on
			if (!selection.fields) {
				continue
			}

			const { value: previousValue } = this.cache._internal_unstable.storage.get(id, key)

			// if its not a list, wrap it as one so we can dry things up
			const links = !Array.isArray(previousValue)
				? [previousValue as string]
				: flattenList(previousValue as LinkedList)

			for (const link of links) {
				if (link !== null) {
					linkedIDs.push([link, selection.fields])
				}
			}
		}

		for (const [linkedRecordID, linkFields] of linkedIDs) {
			this.remove(linkedRecordID, linkFields, targets, visited)
		}
	}

	private removeSubscribers(id: string, fieldName: string, specs: SubscriptionSpec[]) {
		// build up a list of the sets we actually need to remove after
		// checking reference counts
		let targets: SubscriptionSpec['set'][] = []

		for (const spec of specs) {
			// if we dont know this field/set combo, there's nothing to do (probably a bug somewhere)
			if (!this.referenceCounts[id][fieldName]?.has(spec.set)) {
				continue
			}
			const counts = this.referenceCounts[id][fieldName]
			const newVal = (counts.get(spec.set) || 0) - 1

			// decrement the reference of every field
			counts.set(spec.set, newVal)

			// if that was the last reference we knew of
			if (newVal <= 0) {
				targets.push(spec.set)
				// remove the reference to the set function
				counts.delete(spec.set)
			}
		}

		// we do need to remove the set from the list
		if (this.subscribers[id]) {
			this.subscribers[id][fieldName] = this.get(id, fieldName).filter(
				({ set }) => !targets.includes(set)
			)
		}
	}

	removeAllSubscribers(id: string, targets?: SubscriptionSpec[], visited: string[] = []) {
		visited.push(id)

		// every field that currently being subscribed to needs to be cleaned up
		for (const field of Object.keys(this.subscribers[id] || [])) {
			// grab the current set of subscribers
			const subscribers = targets || this.subscribers[id][field]

			// delete the subscriber for the field
			this.removeSubscribers(id, field, subscribers)

			// look up the value for the field so we can remove any subscribers that existed because of a
			// subscriber to this record
			const { value, kind } = this.cache._internal_unstable.storage.get(id, field)

			// if the field is a scalar, there's nothing more to do
			if (kind === 'scalar') {
				continue
			}

			// if the value is a single link , wrap it in a list. otherwise, flatten the link list
			const nextTargets = Array.isArray(value)
				? flattenList(value as LinkedList)
				: [value as string]

			for (const id of nextTargets) {
				// if we have already visited this id, move on
				if (visited.includes(id)) {
					continue
				}

				// keep walking down
				this.removeAllSubscribers(id, subscribers, visited)
			}
		}
	}
}
