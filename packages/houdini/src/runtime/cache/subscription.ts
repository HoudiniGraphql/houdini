import { flatten } from '../flatten.js'
import { getFieldsForType } from '../selection.js'
import type {
	GraphQLValue,
	ListFilter,
	SubscriptionSelection,
	SubscriptionSpec,
	NestedList,
} from '../types.js'
import type { Cache } from './index.js'
import { evaluateKey, rootID } from './stuff.js'

export type FieldSelection = [
	SubscriptionSpec,
	Required<SubscriptionSelection>['fields'] | undefined,
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
				referenceCounts: Map<SubscriptionSpec['onMessage'], number>
				// masked parent subscriptions track documents whose data contains this record
				// behind a masked boundary (eg a fragment spread). they are never
				// notified when a value changes but they do participate in containment
				// lookups (cache.refresh) and write-path propagation so that we always
				// know every document whose data contains a given record
				maskedParentSelections: FieldSelection[]
				maskedParentReferenceCounts: Map<SubscriptionSpec['onMessage'], number>
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
		masked = false,
	}: {
		parent: string
		parentType?: string
		spec: SubscriptionSpec
		selection: SubscriptionSelection
		variables: { [key: string]: GraphQLValue }
		// when true, every subscription we register is a masked parent regardless of the
		// field's visibility. this happens when the walk crosses a masked boundary
		masked?: boolean
	}) {
		// figure out the correct selection
		const __typename = this.cache._internal_unstable.storage.get(parent, '__typename')
			.value as string
		const targetSelection = getFieldsForType(selection, __typename, false)

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

			// once we cross a masked boundary everything below it is a masked parent
			const fieldMasked = masked || !visible

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
				masked: fieldMasked,
			})

			if (list && !fieldMasked) {
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
				const children = !Array.isArray(linkedRecord)
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
						masked: fieldMasked,
					})
				}
			}
		}
	}

	addFieldSubscription({
		id,
		key,
		selection,
		type: _type,
		masked = false,
	}: {
		id: string
		key: string
		selection: FieldSelection
		type: string
		masked?: boolean
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
				maskedParentSelections: [],
				maskedParentReferenceCounts: new Map(),
			})
		}

		const subscriberField = subscriber.get(key)!

		// masked parent subscriptions get tracked separately so they never participate
		// in update notifications
		const selections = masked
			? subscriberField.maskedParentSelections
			: subscriberField.selections
		const referenceCounts = masked
			? subscriberField.maskedParentReferenceCounts
			: subscriberField.referenceCounts

		// if this is the first time we've seen the raw key
		if (!this.keyVersions[key]) {
			this.keyVersions[key] = new Set()
		}

		// add this version of the key if we need to
		this.keyVersions[key].add(key)

		if (!referenceCounts.has(spec.onMessage)) {
			selections.push([spec, selection[1]])
		}

		// we're going to increment the current value by one
		referenceCounts.set(spec.onMessage, (referenceCounts.get(spec.onMessage) || 0) + 1)

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
			filters: Object.entries(filters || {}).reduce((acc, [key, filter]) => {
				return {
					...acc,
					[key]: filterValue(filter, variables),
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
		masked = false,
	}: {
		parent: string
		variables: {}
		subscribers: FieldSelection[]
		parentType: string
		// when true, every subscription we register is a masked parent regardless of the
		// field's visibility. this happens when the batch we are propagating was
		// already behind a masked boundary
		masked?: boolean
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
					visible,
				} = selection

				// once we cross a masked boundary everything below it is a masked parent
				const fieldMasked = masked || !visible

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
					masked: fieldMasked,
				})

				if (list && !fieldMasked) {
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
						const targetSelection = getFieldsForType(childSelection, __typename, false)
						// insert the subscriber
						this.addMany({
							parent: linkedRecord,
							variables,
							subscribers: subscribers.map(([sub]) => [sub, targetSelection]),
							parentType: linkedType,
							masked: fieldMasked,
						})
					}
				}
			}
		}
	}

	get(id: string, field: string): FieldSelection[] {
		return this.subscribers.get(id)?.get(field)?.selections || []
	}

	getMaskedParents(id: string, field: string): FieldSelection[] {
		return this.subscribers.get(id)?.get(field)?.maskedParentSelections || []
	}

	getAll(id: string, { includeMaskedParents = false }: { includeMaskedParents?: boolean } = {}) {
		return [...(this.subscribers.get(id)?.values() || [])].flatMap((fieldSub) =>
			includeMaskedParents
				? fieldSub.selections.concat(fieldSub.maskedParentSelections)
				: fieldSub.selections
		)
	}

	remove(
		id: string,
		selection: SubscriptionSelection,
		targets: SubscriptionSpec[],
		variables: {},
		visited: string[] = [],
		masked: boolean = false
	) {
		visited.push(id)

		// walk down to every record we know about
		const linkedIDs: [string, SubscriptionSelection, boolean][] = []

		// figure out the correct selection
		const __typename = this.cache._internal_unstable.storage.get(id, '__typename')
			.value as string
		const targetSelection = getFieldsForType(selection, __typename, false)

		// look at the fields for ones corresponding to links
		for (const fieldSelection of Object.values(targetSelection || {})) {
			const key = evaluateKey(fieldSelection.keyRaw, variables)

			// mirror the walk that added the subscriptions: once we cross a masked
			// boundary everything below it was registered silently
			const fieldMasked = masked || !fieldSelection.visible

			// remove the subscribers for the field
			this.removeSubscribers(id, key, targets, fieldMasked)

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
					linkedIDs.push([link, fieldSelection.selection || {}, fieldMasked])
				}
			}
		}

		for (const [linkedRecordID, linkFields, linkMasked] of linkedIDs) {
			this.remove(linkedRecordID, linkFields, targets, variables, visited, linkMasked)
		}
	}

	reset() {
		// Get all subscriptions that do not start with the rootID
		const subscribers = [...this.subscribers.entries()].filter(([id]) => !id.startsWith(rootID))

		// Remove those subcribers from this.subscribers
		for (const [id, _fields] of subscribers) {
			this.subscribers.delete(id)
		}

		// Get list of all SubscriptionSpecs of subscribers (including masked parents so
		// that documents holding records only behind fragment boundaries are also notified)
		const subscriptionSpecs = subscribers.flatMap(([_id, fields]) =>
			[...fields.values()].flatMap((field) =>
				field.selections.concat(field.maskedParentSelections).map(([spec]) => spec)
			)
		)

		return subscriptionSpecs
	}

	private removeSubscribers(
		id: string,
		fieldName: string,
		specs: SubscriptionSpec[],
		preferMasked: boolean = false
	) {
		// build up a list of the sets we actually need to remove after
		// checking reference counts
		const targets: SubscriptionSpec['onMessage'][] = []
		const maskedParentTargets: SubscriptionSpec['onMessage'][] = []

		const subscriber = this.subscribers.get(id)
		if (!subscriber) {
			return
		}
		const subscriberField = subscriber.get(fieldName)
		if (!subscriberField) {
			return
		}

		for (const spec of specs) {
			// each removal visit accounts for a single reference that flowed through
			// this link path. we prefer the count map that matches the visibility of
			// the walk that got us here but fall back to the other one so that mixed
			// paths (the same field reached both masked and unmasked) still clean up
			const ordered: Array<
				[Map<SubscriptionSpec['onMessage'], number>, SubscriptionSpec['onMessage'][]]
			> = preferMasked
				? [
						[subscriberField.maskedParentReferenceCounts, maskedParentTargets],
						[subscriberField.referenceCounts, targets],
					]
				: [
						[subscriberField.referenceCounts, targets],
						[subscriberField.maskedParentReferenceCounts, maskedParentTargets],
					]

			// if we dont know this field/set combo, there's nothing to do (probably a bug somewhere)
			const match = ordered.find(([counts]) => counts.has(spec.onMessage))
			if (!match) {
				continue
			}
			const [counts, removed] = match

			const newVal = (counts.get(spec.onMessage) || 0) - 1

			// decrement the reference of every field
			counts.set(spec.onMessage, newVal)
			// if that was the last reference we knew of
			if (newVal <= 0) {
				removed.push(spec.onMessage)
				// remove the reference to the set function
				counts.delete(spec.onMessage)
			}
		}

		// we do need to remove the set from the lists
		subscriberField.selections = subscriberField.selections.filter(
			([{ onMessage }]) => !targets.includes(onMessage)
		)
		subscriberField.maskedParentSelections = subscriberField.maskedParentSelections.filter(
			([{ onMessage }]) => !maskedParentTargets.includes(onMessage)
		)

		// if we have no more references to the field, we need to remove it from the map
		if (
			subscriberField.referenceCounts.size === 0 &&
			subscriberField.maskedParentReferenceCounts.size === 0
		) {
			subscriber.delete(fieldName)
		}

		// if we got this far and there are no subscribers on the field, we need to clean things up
		if (subscriber.size === 0) {
			this.subscribers.delete(id)
		}
	}

	removeAllSubscribers(id: string, targets?: SubscriptionSpec[]) {
		// get the list of subscriptions specs for the id if we didn't provide a specific list
		if (!targets) {
			targets = [...(this.subscribers.get(id)?.values() || [])].flatMap((fieldSub) =>
				fieldSub.selections
					.concat(fieldSub.maskedParentSelections)
					.flatMap((sel) => sel[0]!)
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
		const targetSelection = getFieldsForType(selection, __typename, false)

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

// resolve a list filter to its concrete value, looking up variables
// (including ones nested inside object and list values)
export function filterValue(filter: ListFilter, variables: Record<string, any>): any {
	if (filter.kind === 'Variable') {
		return variables[filter.value as string]
	}
	if (filter.kind === 'Object') {
		return Object.fromEntries(
			Object.entries(filter.value).map(([key, value]) => [
				key,
				filterValue(value, variables),
			])
		)
	}
	if (filter.kind === 'List') {
		return filter.value.map((value) => filterValue(value, variables))
	}
	return filter.value
}
