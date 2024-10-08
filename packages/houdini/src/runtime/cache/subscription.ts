import { flatten } from '../lib/flatten'
import { getFieldsForType } from '../lib/selection'
import type {
	GraphQLValue,
	SubscriptionSelection,
	SubscriptionSpec,
	NestedList,
} from '../lib/types'
import { type Cache } from './cache'
import { evaluateKey, rootID } from './stuff'

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

	private subscribers = new Map<
		string,
		Map<
			string,
			{
				selections: FieldSelection[]
				referenceCounts: Map<SubscriptionSpec['set'], number>
			}
		>
	>()

	private keyVersions: { [key: string]: Set<string> } = {}

	activeFields(parent: string): string[] {
		return Object.keys(this.subscribers.get(parent) || {})
	}

	copySubscribers(from: string, to: string) {
		this.subscribers.set(to, this.subscribers.get(from) || new Map())
	}

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
		let targetSelection = getFieldsForType(selection, __typename, false)

		// walk down the selection
		for (const fieldSelection of Object.values(targetSelection || {})) {
			const {
				keyRaw,
				selection: innerSelection,
				type,
				list,
				filters,
				visible,
			} = fieldSelection
			if (!visible) {
				continue
			}

			const key = evaluateKey(keyRaw, variables)

			// add the subscriber to the field
			let targetSelection: FieldSelection[1]
			if (innerSelection) {
				// figure out the correct selection
				const __typename = this.cache._internal_unstable.storage.get(parent, '__typename')
					.value as string
				targetSelection = getFieldsForType(innerSelection, __typename, false)
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
					: flatten(linkedRecord) || []

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
		if (!this.subscribers.has(id)) {
			this.subscribers.set(id, new Map())
		}

		const subscriber = this.subscribers.get(id)!

		if (!subscriber.has(key)) {
			subscriber.set(key, {
				selections: [],
				referenceCounts: new Map(),
			})
		}

		const subscriberField = subscriber.get(key)!

		// if this is the first time we've seen the raw key
		if (!this.keyVersions[key]) {
			this.keyVersions[key] = new Set()
		}

		// add this version of the key if we need to
		this.keyVersions[key].add(key)

		if (!subscriberField.selections.some(([{ set }]) => set === spec.set)) {
			subscriberField.selections.push([spec, selection[1]])
		}

		// we're going to increment the current value by one
		subscriberField.referenceCounts.set(
			spec.set,
			(subscriberField.referenceCounts.get(spec.set) || 0) + 1
		)

		// reset the lifetime for the key
		this.cache._internal_unstable.lifetimes.resetLifetime(id, key)
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
					? getFieldsForType(innerSelection, parentType, false)
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
						: flatten(link as string[])

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
						let targetSelection = getFieldsForType(childSelection, __typename, false)
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
		return this.subscribers.get(id)?.get(field)?.selections || []
	}

	getAll(id: string): FieldSelection[] {
		return [...(this.subscribers.get(id)?.values() || [])].flatMap(
			(fieldSub) => fieldSub.selections
		)
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
		let targetSelection = getFieldsForType(selection, __typename, false)

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
				: flatten(previousValue as NestedList)

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

	reset() {
		// Get all subscriptions that do not start with the rootID
		const subscribers = [...this.subscribers.entries()].filter(([id]) => !id.startsWith(rootID))

		// Remove those subcribers from this.subscribers
		for (const [id, _fields] of subscribers) {
			this.subscribers.delete(id)
		}

		// Get list of all SubscriptionSpecs of subscribers
		const subscriptionSpecs = subscribers.flatMap(([_id, fields]) =>
			[...fields.values()].flatMap((field) => field.selections.map(([spec]) => spec))
		)

		return subscriptionSpecs
	}

	private removeSubscribers(id: string, fieldName: string, specs: SubscriptionSpec[]) {
		// build up a list of the sets we actually need to remove after
		// checking reference counts
		let targets: SubscriptionSpec['set'][] = []

		const subscriber = this.subscribers.get(id)
		if (!subscriber) {
			return
		}
		const subscriberField = subscriber.get(fieldName)
		for (const spec of specs) {
			const counts = subscriberField?.referenceCounts

			// if we dont know this field/set combo, there's nothing to do (probably a bug somewhere)
			if (!counts?.has(spec.set)) {
				continue
			}
			const newVal = (counts.get(spec.set) || 0) - 1

			// decrement the reference of every field
			counts.set(spec.set, newVal)
			// if that was the last reference we knew of
			if (newVal <= 0) {
				targets.push(spec.set)
				// remove the reference to the set function
				counts.delete(spec.set)
			}

			// if we have no more references to the field, we need to remove it from the map
			if (counts.size === 0) {
				subscriber.delete(fieldName)
			}
		}

		// we do need to remove the set from the list
		if (subscriberField) {
			subscriberField.selections = this.get(id, fieldName).filter(
				([{ set }]) => !targets.includes(set)
			)
		}

		// if we got this far and there are no subscribers on the field, we need to clean things up
		if (subscriber.size === 0) {
			this.subscribers.delete(id)
		}
	}

	removeAllSubscribers(id: string, targets?: SubscriptionSpec[]) {
		// get the list of subscriptions specs for the id if we didn't provide a specific list
		if (!targets) {
			targets = [...(this.subscribers.get(id)?.values() || [])].flatMap((spec) =>
				spec.selections.flatMap((sel) => sel[0]!)
			)
		}

		for (const target of targets) {
			// we shouldn't use the root selection here because we only care about the subselections
			// related to the target
			for (const subselection of this.findSubSelections(
				target.parentID || rootID,
				target.selection,
				target.variables || {},
				id
			)) {
				this.remove(id, subselection, targets, target.variables || {})
			}
		}

		return
	}

	get size() {
		let size = 0
		for (const [, nodeCounts] of this.subscribers) {
			for (const [, { referenceCounts }] of nodeCounts) {
				size += [...referenceCounts.values()].reduce((size, count) => size + count, 0)
			}
		}

		return size
	}

	findSubSelections(
		parentID: string,
		selection: SubscriptionSelection,
		variables: {},
		searchTarget: string,
		selections = [] as Array<SubscriptionSelection>
	): Array<SubscriptionSelection> {
		// walk down the selection, looking up cached information along the way to identity instances where
		// the target id is embedded inside of the selection

		// figure out the correct selection
		const __typename = this.cache._internal_unstable.storage.get(parentID, '__typename')
			.value as string
		let targetSelection = getFieldsForType(selection, __typename, false)

		// look at the fields for ones corresponding to links
		for (const fieldSelection of Object.values(targetSelection || {})) {
			// if the field points to a link then we need to see if the linked record
			// is the one we are looking for
			if (!fieldSelection.selection) {
				continue
			}

			const key = evaluateKey(fieldSelection.keyRaw, variables || {})

			const linkedRecord = this.cache._internal_unstable.storage.get(parentID, key)
			// if the links aren't an array then wrap it
			const links = !Array.isArray(linkedRecord.value)
				? [linkedRecord.value as string]
				: flatten(linkedRecord.value as NestedList)

			// if we found a selection that includes the target, great - we're done and walking down
			// will unsubscribe from everything
			if (links.includes(searchTarget)) {
				selections.push(fieldSelection.selection)
			}
			// if we didn't find the target, we need to keep walking down the selection. maybe its somewhere
			else {
				// we need to keep walking down the selection
				for (const link of links) {
					this.findSubSelections(
						link,
						fieldSelection.selection,
						variables,
						searchTarget,
						selections
					)
				}
			}
		}

		return selections
	}
}
