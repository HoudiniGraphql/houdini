import { flatten } from '../flatten.js'
import type { GraphQLValue } from '../types.js'

// NOTE: the current implementation of delete is slow. it should try to compare the
// type of the id being deleted with the type contained in the linked list so that
// the removal logic is only performed when its possible the ID is found inside.
// ie: deleting a user should not slow down looking up a list of cats

export class InMemoryStorage {
	data: Layer[]
	private idCount = 1
	private rank = 0
	idMaps: Record<string, string> = {}
	// fast lookup: record id → __typename, maintained alongside normal field writes
	typenames: Map<string, string> = new Map()

	constructor() {
		this.data = []
	}

	get layerCount(): number {
		return this.data.length
	}

	get nextRank(): number {
		return this.rank++
	}

	registerIDMapping(from: string, to: string) {
		this.idMaps[from] = to
		this.idMaps[to] = from
	}

	// create a layer and return its id
	createLayer(optimistic: boolean = false): Layer {
		// generate the next layer
		const layer = new Layer(this.idCount++)
		layer.optimistic = optimistic

		// add the layer to the list
		this.data.push(layer)

		// pass the layer on so it can be updated
		return layer
	}

	insert(id: string, field: string, location: OperationLocations, target: string) {
		return this.topLayer.insert(id, field, location, target)
	}

	remove(id: string, field: string, target: string, layer = this.topLayer) {
		return layer.remove(id, field, target)
	}

	delete(id: string, layer = this.topLayer) {
		return layer.delete(id)
	}

	deleteField(id: string, field: string) {
		return this.topLayer.deleteField(id, field)
	}

	// embedded records are only ever referenced by the field that wrote them so once
	// that reference is gone the data can be physically removed. any embedded
	// descendants are left for the garbage collector
	removeEmbeddedRecord(id: string) {
		for (const layer of this.data) {
			// optimistic layers hold their own copy of the data and get rolled back
			// or merged wholesale so we leave them alone
			if (layer.optimistic) {
				continue
			}

			delete layer.fields[id]
			delete layer.links[id]
		}
		this.typenames.delete(id)
	}

	getLayer(id: number): Layer {
		for (const layer of this.data) {
			if (layer.id === id) {
				return layer
			}
		}

		// we didn't find the layer
		throw new Error(`Could not find layer with id: ${id}`)
	}

	replaceID(replacement: { from: string; to: string }) {
		for (const layer of this.data) {
			layer.replaceID(replacement)
		}
		const typename = this.typenames.get(replacement.from)
		if (typename) this.typenames.set(replacement.to, typename)
	}
	get(
		targetID: string,
		field: string,
		defaultValue?: any
	): {
		value: GraphQLField
		kind: 'link' | 'scalar' | 'unknown'
		displayLayers: number[]
	} {
		// Lazy accumulators — only allocated when we actually encounter list
		// operations. Scalar reads (the common case) never touch these.
		let insertStart: string[] | undefined
		let insertEnd: string[] | undefined
		let removeSet: Set<string> | undefined
		let layerIDs: number[] | undefined

		// the record might be known by multiple ids and we need to look at every layer
		// in the correct order
		const mappedID = this.idMaps[targetID]
		const recordIDs = mappedID ? [mappedID, targetID] : [targetID]

		// go through the list of layers in reverse
		for (let i = this.data.length - 1; i >= 0; i--) {
			// consider every id that we know about
			for (const id of recordIDs) {
				const layer = this.data[i]
				let [layerValue, kind] = layer.get(id, field)

				const layerOperations = layer.getOperations(id, field)
				if (layer.deletedIDs.size > 0) {
					layer.deletedIDs.forEach((v) => {
						// if the layer wants to undo a delete for the id
						if (layer.operations[v]?.undoDeletesInList?.includes(field)) {
							return
						}
						if (!removeSet) removeSet = new Set()
						removeSet.add(v)
						if (this.idMaps[v]) {
							removeSet.add(this.idMaps[v])
						}
					})
				}

				// if we don't have a value to return, we're done
				if (typeof layerValue === 'undefined' && defaultValue) {
					const targetLayer = this.topLayer
					targetLayer.writeField(id, field, defaultValue)
					layerValue = defaultValue
				}

				// if the layer does not contain a value for the field, move on
				if (typeof layerValue === 'undefined' && !layerOperations?.length) {
					if (layer.deletedIDs.size > 0) {
						if (!layerIDs) layerIDs = []
						layerIDs.push(layer.id)
					}
					continue
				}

				// if the result isn't an array we can just use the value since we can't
				// apply operations to the field
				if (typeof layerValue !== 'undefined' && !Array.isArray(layerValue)) {
					return {
						value: layerValue,
						kind,
						displayLayers: [layer.id],
					}
				}

				// if the layer contains operations or values add it to the list of relevant layers
				if (!layerIDs) layerIDs = []
				layerIDs.push(layer.id)

				// if we have an operation
				if (layerOperations?.length) {
					// process every operation
					for (const op of layerOperations) {
						// remove operation
						if (isRemoveOperation(op)) {
							if (!removeSet) removeSet = new Set()
							removeSet.add(op.id)
						}
						// inserts are sorted by location
						if (isInsertOperation(op)) {
							if (op.location === OperationLocation.end) {
								if (!insertEnd) insertEnd = []
								insertEnd.unshift(op.id)
							} else {
								if (!insertStart) insertStart = []
								insertStart.push(op.id)
							}
						}
						// if we found a delete operation, we're done
						if (isDeleteOperation(op)) {
							return {
								value: undefined,
								kind: 'unknown',
								displayLayers: [],
							}
						}
					}
				}

				// if we don't have a value to return, we're done
				if (typeof layerValue === 'undefined') {
					continue
				}

				// if there are no operations, move along
				if (!removeSet?.size && !insertStart?.length && !insertEnd?.length) {
					return { value: layerValue, displayLayers: layerIDs, kind: 'link' }
				}

				// we have operations to apply to the list
				return {
					value: [...(insertStart ?? []), ...layerValue, ...(insertEnd ?? [])].filter(
						(value) => !removeSet?.has(value as string)
					),
					displayLayers: layerIDs,
					kind,
				}
			}
		}

		return {
			value: undefined,
			kind: 'unknown',
			displayLayers: [],
		}
	}

	writeLink(id: string, field: string, value: string | NestedList) {
		// write to the top most layer
		return this.topLayer.writeLink(id, field, value)
	}

	writeField(id: string, field: string, value: GraphQLValue) {
		return this.topLayer.writeField(id, field, value)
	}

	resolveLayer(id: number): void {
		let startingIndex: number | null = null

		// find the layer with the matching id
		for (const [index, layer] of this.data.entries()) {
			if (layer.id !== id) {
				continue
			}

			// we found the target layer
			startingIndex = index - 1

			// its not optimistic any more
			this.data[index].optimistic = false

			// we're done
			break
		}

		// if we didn't find the layer, yell loudly
		if (startingIndex === null) {
			throw new Error(`could not find layer with id: ${id}`)
		}

		// if we are resolving the base layer make sure we start at zero
		if (startingIndex === -1) {
			startingIndex = 0
		}

		// if the starting layer is optimistic then we can't write to it
		if (this.data[startingIndex].optimistic) {
			startingIndex++
		}

		// start walking down the list of layers, applying any non-optimistic ones to the target
		const baseLayer = this.data[startingIndex]
		let layerIndex = startingIndex
		while (layerIndex < this.data.length) {
			// the layer in question and move the counter up one after we index
			const layer = this.data[layerIndex++]

			// if the layer is optimistic, we can't go further
			if (layer.optimistic) {
				layerIndex--
				break
			}

			// apply the layer onto our base
			baseLayer.writeLayer(layer)
		}

		// delete the layers we merged
		this.data.splice(startingIndex + 1, layerIndex - startingIndex - 1)

		// if everything had merged down then there are no optimistic layers left and we can
		// reset any deleted id mappings
		if (this.data.length === 1) {
			this.idMaps = {}
		}
	}

	get topLayer(): Layer {
		// if there is no base layer
		if (this.data.length === 0) {
			this.createLayer()
		}

		// if the last layer is optimistic, create another layer on top of it
		// since optimistic layers have to be written to directly
		if (this.data[this.data.length - 1]?.optimistic) {
			this.createLayer()
		}

		// the top layer is safe to write to (its non-null and guaranteed not optimistic)
		return this.data[this.data.length - 1]
	}

	// return a string representation of all of the data and necessary state to
	// recreate the information stored
	serialize() {
		// TODO: read all layers, not just top one
		return JSON.stringify({
			rank: this.rank,
			fields: Object.fromEntries(
				Object.entries(this.topLayer.fields).map(([id, fieldMap]) => [
					id,
					Object.fromEntries(
						Object.entries(fieldMap).filter(([_, value]) => typeof value !== 'function')
					),
				])
			),
			links: this.topLayer.links,
		})
	}

	hydrate(
		args?: {
			rank: number
			fields: EntityFieldMap
			links: LinkMap
		},
		layer?: Layer
	) {
		if (!args) {
			return
		}
		const { rank, fields, links } = args

		this.rank = rank

		// a hydration layer is always standlone. treat it as an optimistic layer that never resolves
		layer ??= this.createLayer(true)
		layer.fields = fields
		layer.links = links

		// return the layer so callers that hydrate several snapshots can merge them back down
		// (via resolveLayer) instead of reusing — and clobbering — a single shared layer
		return layer
	}

	// fast typename lookup with lazy-populate fallback for records written via hydrate()
	getTypename(id: string): string | undefined {
		let typename = this.typenames.get(id)
		if (typename === undefined) {
			typename = this.get(id, '__typename').value as string | undefined
			if (typename !== undefined) this.typenames.set(id, typename)
		}
		return typename
	}

	reset() {
		this.data = []
		this.typenames.clear()
	}
}

export class Layer {
	readonly id: LayerID

	optimistic: boolean = false

	fields: EntityFieldMap = {}
	links: LinkMap = {}
	operations: OperationMap = {}
	deletedIDs = new Set<string>()

	constructor(id: number) {
		this.id = id
	}

	get(id: string, field: string): [GraphQLField, 'link' | 'scalar'] {
		// if its a link return the value
		if (typeof this.links[id]?.[field] !== 'undefined') {
			return [this.links[id][field], 'link']
		}

		// only other option is a value
		return [this.fields[id]?.[field], 'scalar']
	}

	getOperations(id: string, field: string): Operation[] | undefined {
		const ops = this.operations[id]
		if (!ops) return undefined
		if (ops.deleted) return [{ kind: OperationKind.delete, target: id }]
		return ops.fields?.[field]
	}

	writeField(id: string, field: string, value: GraphQLField): LayerID {
		const record = this.fields[id]
		if (record) {
			record[field] = value
		} else {
			this.fields[id] = { [field]: value }
		}

		return this.id
	}

	writeLink(id: string, field: string, value: null | string | NestedList): LayerID {
		// if any of the values in this link are flagged to be deleted, undelete it
		const valueList = Array.isArray(value) ? value : [value]
		for (const value of flatten(valueList)) {
			if (!value) {
				continue
			}

			const fieldOperations = this.operations[id]?.fields[field]

			// if the operation was globally deleted
			if (this.operations[value]?.deleted || this.deletedIDs.has(value)) {
				// undo the delete
				this.operations[value] = {
					...this.operations[value],
					undoDeletesInList: [...(this.operations[id]?.undoDeletesInList || []), field],
				}

				// the value could have been removed specifically from the list
			} else if (value && fieldOperations?.length > 0) {
				// if we have a field operation to remove the list, undo the operation
				this.operations[id].fields[field] = fieldOperations.filter(
					(op) => op.kind !== 'remove' || op.id !== value
				)
			}
		}

		const linkRecord = this.links[id]
		if (linkRecord) {
			linkRecord[field] = value
		} else {
			this.links[id] = { [field]: value }
		}

		return this.id
	}

	isDisplayLayer(displayLayers: number[]) {
		const n = displayLayers.length
		if (n === 0) return true
		let max = 0
		for (let i = 0; i < n; i++) {
			const d = displayLayers[i]
			if (d === this.id) return true
			if (d > max) max = d
		}
		return max < this.id
	}

	clear() {
		// now that everything has been notified we can reset the data
		this.links = {}
		this.fields = {}
		this.operations = {}
		this.deletedIDs = new Set<string>()
	}

	replaceID({ from, to }: { from: string; to: string }) {
		// any fields that existing in from, assign to to
		this.fields[to] = this.fields[from]
		this.links[to] = this.links[from]
		this.operations[to] = this.operations[from] || { fields: {} }
		if (this.deletedIDs.has(from)) {
			this.deletedIDs.add(to)
		}
	}

	removeUndefinedFields() {
		// any field that's marked as undefined needs to be deleted
		for (const [id, fields] of Object.entries(this.fields)) {
			for (const [field, value] of Object.entries(fields)) {
				if (typeof value === 'undefined') {
					try {
						delete this.fields[id][field]
					} catch {}
					try {
						delete this.links[id][field]
					} catch {}
				}
			}

			// if there are no fields left for the object, clean it up
			if (Object.keys(fields || {}).length === 0) {
				delete this.fields[id]
			}

			// if there are no more links, clean it up
			if (Object.keys(this.links[id] || {}).length === 0) {
				delete this.links[id]
			}
		}
	}

	delete(id: string) {
		// add an insert operation to the map
		this.operations = {
			...this.operations,
			[id]: {
				...this.operations[id],
				deleted: true,
				// reapply any delete undos
				undoDeletesInList: [],
			},
		}

		// add the id to the list of ids that have been deleted in this layer (so we can filter them out later)
		this.deletedIDs.add(id)
	}

	deleteField(id: string, field: string) {
		this.fields[id] = {
			...this.fields[id],
			[field]: undefined,
		}
	}

	insert(id: string, field: string, where: OperationLocations, target: string) {
		// add an insert operation for the field
		this.addFieldOperation(id, field, {
			kind: OperationKind.insert,
			id: target,
			location: where,
		})
	}

	remove(id: string, field: string, target: string) {
		// add a remove operation for the field
		this.addFieldOperation(id, field, {
			kind: OperationKind.remove,
			id: target,
		})
	}

	writeLayer(layer: Layer): void {
		// if we are merging into ourselves, we're done
		if (layer.id === this.id) {
			return
		}

		// we have to apply operations before we move fields so we can clean up existing
		// data if we have a delete before we copy over the values
		for (const [id, ops] of Object.entries(layer.operations)) {
			const fields: OperationMap['fieldName']['fields'] = {}

			// merge the two operation maps
			for (const opMap of [layer.operations[id], this.operations[id]].filter(Boolean)) {
				for (const [fieldName, operations] of Object.entries(opMap.fields || {})) {
					fields[fieldName] = [...(fields[fieldName] || []), ...operations]
				}
			}

			// Each mutation writes to an optimistic layer that gets resolved (merged) into
			// the base layer here. If a toggle fires twice — insert in M1, remove in M2 —
			// both operations end up in the base after their layers resolve. A third mutation
			// (insert again) would then be cancelled by the stale remove from M2, so the
			// list appears stuck. We fix this by compacting the merged operation list:
			// for each ID, compute the net count (inserts minus removes) and keep only that
			// many operations, favouring the newest ones (layer's ops come first in the array).
			for (const [fieldName, ops] of Object.entries(fields)) {
				// count how many times each ID is inserted and removed across both layers
				const insertCount = new Map<string, number>()
				const removeCount = new Map<string, number>()
				for (const op of ops) {
					if (isInsertOperation(op))
						insertCount.set(op.id, (insertCount.get(op.id) ?? 0) + 1)
					else if (isRemoveOperation(op))
						removeCount.set(op.id, (removeCount.get(op.id) ?? 0) + 1)
				}

				// net > 0 means the ID should end up inserted that many more times than removed,
				// net < 0 means it should end up removed that many more times than inserted,
				// net = 0 means the operations cancel completely and nothing should be stored
				const net = new Map<string, number>()
				for (const [id, n] of insertCount) net.set(id, n)
				for (const [id, n] of removeCount) net.set(id, (net.get(id) ?? 0) - n)

				// walk the ops array (newest first) and keep only as many inserts/removes
				// as the net dictates, discarding the excess older ones
				const keptInserts = new Map<string, number>()
				const keptRemoves = new Map<string, number>()
				fields[fieldName] = ops.filter((op) => {
					if (isInsertOperation(op)) {
						const n = net.get(op.id) ?? 0
						// net is zero or negative — no inserts survive
						if (n <= 0) return false
						const kept = keptInserts.get(op.id) ?? 0
						// already kept enough newer inserts
						if (kept >= n) return false
						keptInserts.set(op.id, kept + 1)
						return true
					}
					if (isRemoveOperation(op)) {
						const n = net.get(op.id) ?? 0
						// net is zero or positive — no removes survive
						if (n >= 0) return false
						const kept = keptRemoves.get(op.id) ?? 0
						// already kept enough newer removes
						if (kept >= -n) return false
						keptRemoves.set(op.id, kept + 1)
						return true
					}
					return true
				})
			}

			// only copy a field key if there is something
			if (Object.keys(fields).length > 0) {
				this.operations[id] = {
					...this.operations[id],
					fields,
				}
			}

			// if we are applying
			if (ops?.deleted) {
				delete this.fields[id]
				delete this.links[id]
			}
		}

		// copy the field values
		for (const [id, values] of Object.entries(layer.fields)) {
			if (!values) {
				continue
			}
			// we do have a record matching this id, copy the individual fields
			for (const [field, value] of Object.entries(values)) {
				this.writeField(id, field, value)
			}
		}

		// copy the link values
		for (const [id, values] of Object.entries(layer.links)) {
			if (!values) {
				continue
			}
			// we do have a record matching this id, copy the individual links
			for (const [field, value] of Object.entries(values)) {
				this.writeLink(id, field, value)
			}
		}

		// add the list of deleted ids to this layer
		layer.deletedIDs.forEach((v) => {
			this.deletedIDs.add(v)
		})
	}

	private addFieldOperation(id: string, field: string, operation: ListOperation) {
		this.operations = {
			...this.operations,
			[id]: {
				...this.operations[id],
				fields: {
					...this.operations[id]?.fields,
					[field]: [...(this.operations[id]?.fields[field] || []), operation],
				},
			},
		}
	}
}

type GraphQLField = GraphQLValue | NestedList

type EntityMap<_Value> = { [id: string]: { [field: string]: _Value } }

type EntityFieldMap = EntityMap<GraphQLField>

type LinkMap = EntityMap<string | null | NestedList>

type OperationMap = {
	[id: string]: {
		deleted?: boolean
		undoDeletesInList?: string[]
		fields: { [field: string]: ListOperation[] }
	}
}

type NestedList<_Result = string> = (_Result | null | NestedList<_Result>)[]

type InsertOperation = {
	kind: 'insert'
	location: OperationLocations
	id: string
}

type RemoveOperation = {
	kind: 'remove'
	id: string
}

type DeleteOperation = {
	kind: 'delete'
	target: string
}

type ListOperation = InsertOperation | RemoveOperation

function isDeleteOperation(value: GraphQLField | Operation): value is DeleteOperation {
	return !!value && (value as Operation).kind === OperationKind.delete
}

function isInsertOperation(value: GraphQLField | Operation): value is InsertOperation {
	return !!value && (value as Operation).kind === OperationKind.insert
}

function isRemoveOperation(value: GraphQLField | Operation): value is RemoveOperation {
	return !!value && (value as Operation).kind === OperationKind.remove
}

type Operation = ListOperation | DeleteOperation

type ValuesOf<Target> = Target[keyof Target]

export const OperationLocation = {
	start: 'start',
	end: 'end',
} as const

export type OperationLocations = ValuesOf<typeof OperationLocation>

export const OperationKind = {
	delete: 'delete',
	insert: 'insert',
	remove: 'remove',
} as const

export type OperationKinds = ValuesOf<typeof OperationKind>

export type LayerID = number
