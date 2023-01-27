import { getFieldsForType } from '../lib/selection'
import type { GraphQLValue, SubscriptionSelection, SubscriptionSpec } from '../lib/types'
import type { Cache, LinkedList } from './cache'
import { evaluateKey, flattenList } from './stuff'

export type FieldSelection = [
	SubscriptionSpec,
	Required<SubscriptionSelection>['fields'] | undefined
]

// manage the subscriptions
export class InMemorySubscriptions {
	private cache: Cache

	constructor(cache: Cache) {
		this.cache = cache
	}

	private subscribers: {
		[id: string]: { [fieldName: string]: FieldSelection[] }
	} = {}
	private referenceCounts: {
		[id: string]: { [fieldName: string]: Map<SubscriptionSpec['set'], number> }
	} = {}
	private keyVersions: { [key: string]: Set<string> } = {}

	add({
		parent,
		spec,
		selection,
		variables,
		parentType,
	}: {
		parent: string
		parentType?: string
		spec: SubscriptionSpec
		selection: SubscriptionSelection
		variables: { [key: string]: GraphQLValue }
	}) {
		// figure out the correct selection
		const __typename = this.cache._internal_unstable.storage.get(parent, '__typename')
			.value as string
		let targetSelection = getFieldsForType(selection, __typename)

		// walk down the selection
		for (const fieldSelection of Object.values(targetSelection || {})) {
			const { keyRaw, selection: innerSelection, type, list, filters } = fieldSelection

			const key = evaluateKey(keyRaw, variables)

			// add the subscriber to the field
			let targetSelection: FieldSelection[1]
			if (innerSelection) {
				// figure out the correct selection
				const __typename = this.cache._internal_unstable.storage.get(parent, '__typename')
					.value as string
				targetSelection = getFieldsForType(innerSelection, __typename)
			}
			this.addFieldSubscription({
				id: parent,
				key,
				selection: [spec, targetSelection],
				type,
			})

			if (list) {
				this.registerList({
					list,
					filters,
					id: parent,
					key,
					variables,
					selection: innerSelection!,
					parentType: parentType || spec.rootType,
				})
			}
			// if the field points to a link, we need to subscribe to any fields of that
			// linked record
			if (innerSelection) {
				// if the link points to a record then we just have to add it to the one
				const { value: linkedRecord } = this.cache._internal_unstable.storage.get(
					parent,
					key
				)
				let children = !Array.isArray(linkedRecord)
					? [linkedRecord]
					: flattenList(linkedRecord) || []

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
						selection: innerSelection,
						variables,
						parentType: type,
					})
				}
			}
		}
	}

	addFieldSubscription({
		id,
		key,
		selection,
		type,
	}: {
		id: string
		key: string
		selection: FieldSelection
		type: string
	}) {
		const spec = selection[0]
		// if we haven't seen the id or field before, create a list we can add to
		if (!this.subscribers[id]) {
			this.subscribers[id] = {}
		}
		if (!this.subscribers[id][key]) {
			this.subscribers[id][key] = []
		}

		// if this is the first time we've seen the raw key
		if (!this.keyVersions[key]) {
			this.keyVersions[key] = new Set()
		}

		// add this version of the key if we need to
		this.keyVersions[key].add(key)

		if (!this.subscribers[id][key].map(([{ set }]) => set).includes(spec.set)) {
			this.subscribers[id][key].push([spec, selection[1]])
		}

		// if this is the first time we've seen this key
		if (!this.referenceCounts[id]) {
			this.referenceCounts[id] = {}
		}
		if (!this.referenceCounts[id][key]) {
			this.referenceCounts[id][key] = new Map()
		}
		const counts = this.referenceCounts[id][key]

		// we're going to increment the current value by one
		counts.set(spec.set, (counts.get(spec.set) || 0) + 1)

		// reset the lifetime for the key
		this.cache._internal_unstable.lifetimes.resetLifetime(id, key)

		// if this field is marked as a list, register it. this will overwrite existing list handlers
		// so that they can get up to date filters
		const { selection: innerSelection } = selection[1]?.[key] ?? {}
	}

	registerList({
		list,
		id,
		key,
		parentType,
		selection,
		filters,
		variables,
	}: {
		list: Required<Required<SubscriptionSelection>['fields'][string]>['list']
		selection: SubscriptionSelection
		id: string
		parentType: string
		key: string
		filters: Required<SubscriptionSelection>['fields'][string]['filters']
		variables: Record<string, any>
	}) {
		this.cache._internal_unstable.lists.add({
			name: list.name,
			connection: list.connection,
			recordID: id,
			recordType:
				(this.cache._internal_unstable.storage.get(id, '__typename')?.value as string) ||
				parentType,
			listType: list.type,
			key,
			selection: selection,
			filters: Object.entries(filters || {}).reduce((acc, [key, { kind, value }]) => {
				return {
					...acc,
					[key]: kind !== 'Variable' ? value : variables[value as string],
				}
			}, {}),
		})
	}

	// this is different from add because of the treatment of lists
	addMany({
		parent,
		variables,
		subscribers,
		parentType,
	}: {
		parent: string
		variables: {}
		subscribers: FieldSelection[]
		parentType: string
	}) {
		// every subscriber specifies a different selection set to add to the parent
		for (const [spec, targetSelection] of subscribers) {
			// look at every field in the selection and add the subscribers
			for (const selection of Object.values(targetSelection ?? {})) {
				const {
					type: linkedType,
					keyRaw,
					selection: innerSelection,
					list,
					filters,
				} = selection
				const key = evaluateKey(keyRaw, variables)

				// figure out the selection for the field we are writing
				const fieldSelection = innerSelection
					? getFieldsForType(innerSelection, parentType)
					: undefined

				this.addFieldSubscription({
					id: parent,
					key,
					selection: [spec, fieldSelection],
					type: linkedType,
				})

				if (list) {
					this.registerList({
						list,
						filters,
						id: parent,
						key,
						variables,
						selection: innerSelection!,
						parentType: parentType || spec.rootType,
					})
				}
				// if there are fields under this
				const childSelection = selection.selection
				if (childSelection) {
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

						// figure out the correct selection
						const __typename = this.cache._internal_unstable.storage.get(
							linkedRecord,
							'__typename'
						).value as string
						let targetSelection = getFieldsForType(childSelection, __typename)
						// insert the subscriber
						this.addMany({
							parent: linkedRecord,
							variables,
							subscribers: subscribers.map(([sub]) => [sub, targetSelection]),
							parentType: linkedType,
						})
					}
				}
			}
		}
	}

	get(id: string, field: string): FieldSelection[] {
		return this.subscribers[id]?.[field] || []
	}

	remove(
		id: string,
		selection: SubscriptionSelection,
		targets: SubscriptionSpec[],
		variables: {},
		visited: string[] = []
	) {
		visited.push(id)

		// walk down to every record we know about
		const linkedIDs: [string, SubscriptionSelection][] = []

		// figure out the correct selection
		const __typename = this.cache._internal_unstable.storage.get(id, '__typename')
			.value as string
		let targetSelection = getFieldsForType(selection, __typename)

		// look at the fields for ones corresponding to links
		for (const fieldSelection of Object.values(targetSelection || {})) {
			const key = evaluateKey(fieldSelection.keyRaw, variables)

			// remove the subscribers for the field
			this.removeSubscribers(id, key, targets)

			// if there is no subselection it doesn't point to a link, move on
			if (!fieldSelection.selection) {
				continue
			}

			const { value: previousValue } = this.cache._internal_unstable.storage.get(id, key)

			// if its not a list, wrap it as one so we can dry things up
			const links = !Array.isArray(previousValue)
				? [previousValue as string]
				: flattenList(previousValue as LinkedList)

			for (const link of links) {
				if (link !== null) {
					linkedIDs.push([link, fieldSelection.selection || {}])
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
			if (!this.referenceCounts[id]?.[fieldName]?.has(spec.set)) {
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
				([{ set }]) => !targets.includes(set)
			)
		}
	}

	removeAllSubscribers(id: string, targets?: SubscriptionSpec[], visited: string[] = []) {
		visited.push(id)

		// every field that currently being subscribed to needs to be cleaned up
		for (const field of Object.keys(this.subscribers[id] || [])) {
			// grab the current set of subscribers
			const subscribers = targets || this.subscribers[id][field].map(([spec]) => spec)

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
