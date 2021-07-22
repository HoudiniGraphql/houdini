// local imports
import { GraphQLValue, Maybe, SubscriptionSpec } from '../types'
import { Cache } from './cache'

type List = {
	name: string
	parentID: string | undefined
}

// for the most part, this is a very low-level/dumb class that is meant to track state related
// to a specific entity in the cached graph.
export class Record {
	fields: { [key: string]: GraphQLValue } = {}

	keyVersions: { [key: string]: Set<string> } = {}
	readonly id: string
	private subscribers: { [key: string]: SubscriptionSpec[] } = {}
	private recordLinks: { [key: string]: string | null } = {}
	private listLinks: { [key: string]: (string | null)[] } = {}
	private cache: Cache
	private referenceCounts: {
		[fieldName: string]: Map<SubscriptionSpec['set'], number>
	} = {}
	lists: List[] = []

	constructor(cache: Cache, id: string) {
		this.cache = cache
		this.id = id
	}

	allSubscribers() {
		return Object.values(this.subscribers).flatMap((subscribers) => subscribers)
	}

	getField(fieldName: string): GraphQLValue {
		return this.fields[fieldName]
	}

	writeField(fieldName: string, value: GraphQLValue) {
		this.fields[fieldName] = value
	}

	writeRecordLink(fieldName: string, value: string | null) {
		this.recordLinks[fieldName] = value
	}

	writeListLink(fieldName: string, value: (string | null)[]) {
		this.listLinks[fieldName] = value
	}

	linkedRecord(fieldName: string) {
		const linkedRecord = this.recordLinks[fieldName]
		if (linkedRecord === null) {
			return null
		}

		return this.cache.internal.getRecord(linkedRecord)
	}

	linkedRecordID(fieldName: string) {
		return this.recordLinks[fieldName]
	}

	linkedListIDs(fieldName: string): (string | null)[] {
		return this.listLinks[fieldName] || []
	}

	linkedList(fieldName: string): Maybe<Record>[] {
		return (this.listLinks[fieldName] || []).map(this.cache.internal.getRecord)
	}

	appendLinkedList(fieldName: string, id: string) {
		// this could be the first time we've seen the list
		if (!this.listLinks[fieldName]) {
			this.listLinks[fieldName] = []
		}

		this.listLinks[fieldName].push(id)
	}

	prependLinkedList(fieldName: string, id: string) {
		// this could be the first time we've seen the list
		if (!this.listLinks[fieldName]) {
			this.listLinks[fieldName] = []
		}

		this.listLinks[fieldName].unshift(id)
	}

	removeFromLinkedList(fieldName: string, id: string) {
		this.listLinks[fieldName] = (this.listLinks[fieldName] || []).filter((link) => link !== id)
	}

	addSubscriber(rawKey: string, key: string, ...specs: SubscriptionSpec[]) {
		// if this is the first time we've seen the raw key
		if (!this.keyVersions[rawKey]) {
			this.keyVersions[rawKey] = new Set()
		}

		// add this version of the key if we need to
		this.keyVersions[rawKey].add(key)

		// the existing list
		const existingSubscribers = (this.subscribers[key] || []).map(({ set }) => set)
		// the list of new subscribers
		const newSubscribers = specs.filter(({ set }) => !existingSubscribers.includes(set))

		this.subscribers[key] = this.getSubscribers(key).concat(...newSubscribers)

		// if this is the first time we've seen this key
		if (!this.referenceCounts[key]) {
			this.referenceCounts[key] = new Map()
		}
		const counts = this.referenceCounts[key]

		// increment the reference count for every subscriber
		for (const spec of specs) {
			// we're going to increment the current value by one
			counts.set(spec.set, (counts.get(spec.set) || 0) + 1)
		}
	}

	getSubscribers(fieldName: string): SubscriptionSpec[] {
		return this.subscribers[fieldName] || []
	}

	forgetSubscribers(...targets: SubscriptionSpec[]) {
		this.forgetSubscribers_walk(targets.map(({ set }) => set))
	}

	removeAllSubscribers() {
		this.forgetSubscribers(...this.allSubscribers())
	}

	addListReference(ref: List) {
		this.lists.push(ref)
	}

	removeListReference(ref: List) {
		this.lists = this.lists.filter(
			(conn) => !(conn.name === ref.name && conn.parentID === ref.parentID)
		)
	}

	removeAllSubscriptionVersions(keyRaw: string, spec: SubscriptionSpec) {
		// visit every version of the key we've seen and remove the spec from the list of subscribers
		const versions = this.keyVersions[keyRaw]
		// if there are no known versions, we're done
		if (!versions) {
			return
		}

		this.removeSubscribers([...this.keyVersions[keyRaw]], [spec.set])
	}

	private forgetSubscribers_walk(targets: SubscriptionSpec['set'][], visited: string[] = []) {
		// clean up any subscribers that reference the set
		this.removeSubscribers(Object.keys(this.subscribers), targets)
		visited.push(this.id)

		// walk down to every record we know about
		const linkedIDs = Object.keys(this.recordLinks)
		for (const key of Object.keys(this.listLinks)) {
			for (const child of this.listLinks[key]) {
				if (child !== null) {
					linkedIDs.push(child)
				}
			}
		}

		for (const linkedRecordID of linkedIDs) {
			if (visited.includes(linkedRecordID)) {
				continue
			}

			this.cache.internal.getRecord(linkedRecordID)?.forgetSubscribers_walk(targets, visited)
		}
	}

	removeSubscribers(fields: string[], sets: SubscriptionSpec['set'][]) {
		// clean up any subscribers that reference the set
		for (const fieldName of fields) {
			// build up a list of the sets we actually need to remove after
			// checking reference counts
			let targets: SubscriptionSpec['set'][] = []

			for (const set of sets) {
				// if we dont know this field/set combo, there's nothing to do (probably a bug somewhere)
				if (!this.referenceCounts[fieldName]?.has(set)) {
					continue
				}
				const counts = this.referenceCounts[fieldName]
				const newVal = (counts.get(set) || 0) - 1

				// decrement the reference of every field
				counts.set(set, newVal)

				// if that was the last reference we knew of
				if (newVal <= 0) {
					targets.push(set)
					// remove the count too
					counts.delete(set)
				}
			}

			// we do need to remove the set from the list
			this.subscribers[fieldName] = this.getSubscribers(fieldName).filter(
				({ set }) => !targets.includes(set)
			)
		}
	}
}
