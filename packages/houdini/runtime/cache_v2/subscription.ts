import { LinkedList } from '../cache/cache'
import { SubscriptionSpec, SubscriptionSelection } from '../types'
import { InMemoryStorage } from './storage'
import { evaluateKey, flattenList } from './stuff'

// manage the subscriptions
export class InMemorySubscriptions {
	private storage: InMemoryStorage

	constructor(storage: InMemoryStorage) {
		this.storage = storage
	}

	private subscribers: { [id: string]: { [fieldName: string]: SubscriptionSpec[] } } = {}
	private referenceCounts: {
		[id: string]: { [fieldName: string]: Map<SubscriptionSpec['set'], number> }
	} = {}
	keyVersions: { [key: string]: Set<string> } = {}

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
			// if (selection.list) {
			// 	this._lists.delete(selection.list.name)
			// }

			// if there is no subselection it doesn't point to a link, move on
			if (!selection.fields) {
				continue
			}

			const [previousValue] = this.storage.get(id, key)

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
}
