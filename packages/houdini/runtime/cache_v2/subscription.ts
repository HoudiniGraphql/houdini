import { LinkedList } from '../cache/cache'
import { SubscriptionSpec, SubscriptionSelection } from '../types'
import { InMemoryStorage } from './storage'
import { flattenList } from './stuff'

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

	add(id: string, field: string, spec: SubscriptionSpec) {
		// if we haven't seen the id or field before, create a list we can add to
		if (!this.subscribers[id]) {
			this.subscribers[id] = {}
		}
		if (!this.subscribers[id][field]) {
			this.subscribers[id][field] = []
		}

		this.subscribers[id][field].push(spec)
	}

	get(id: string, field: string): SubscriptionSpec[] {
		return this.subscribers[id]?.[field] || []
	}

	remove(
		id: string,
		fields: SubscriptionSelection,
		targets: SubscriptionSpec[],
		visited: string[] = []
	) {
		visited.push(id)

		// walk down to every record we know about
		const linkedIDs: [string, SubscriptionSelection][] = []

		// look at the fields for ones corresponding to links
		for (const [fieldName, selection] of Object.entries(fields)) {
			// remove the subscribers for the field
			this.removeSubscribers(id, fieldName, targets)

			// if there is no subselection it doesn't point to a link, move on
			if (!selection.fields) {
				continue
			}

			const [previousValue] = this.storage.get(id, fieldName)

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
			if (visited.includes(linkedRecordID)) {
				continue
			}

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
		this.subscribers[id][fieldName] = this.get(id, fieldName).filter(
			({ set }) => !targets.includes(set)
		)
	}
}
