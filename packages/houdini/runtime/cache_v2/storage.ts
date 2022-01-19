import { GraphQLValue } from '../types'

export class InMemoryStorage {
	private _data: Layer[]
	private idCount = 0

	constructor() {
		this._data = []
	}

	get layerCount(): number {
		return this._data.length
	}

	// create a layer and return its id
	createLayer(optimistic: boolean = false): Layer {
		// generate the next layer
		const layer = new Layer(this.idCount++)
		layer.optimistic = optimistic

		// add the layer to the list
		this._data.push(layer)

		// pass the layer on so it can be updated
		return layer
	}

	insert(id: string, field: string, location: OperationLocation, target: string) {
		return this.topLayer.insert(id, field, location, target)
	}

	remove(id: string, field: string, target: string) {
		return this.topLayer.remove(id, field, target)
	}

	delete(id: string) {
		return this.topLayer.delete(id)
	}

	get(id: string, field: string): GraphQLField {
		// the list of operations for the field
		const operations = {
			[OperationKind.insert]: {
				[OperationLocation.start]: [] as string[],
				[OperationLocation.end]: [] as string[],
			},
			[OperationKind.remove]: [] as string[],
		}

		// go through the list of layers in reverse
		for (let i = this._data.length - 1; i >= 0; i--) {
			const layerValue = this._data[i].get(id, field)
			const layerOperations = this._data[i].getOperations(id, field) || []

			// if the layer does not contain a value for the field, move on
			if (typeof layerValue === 'undefined' && typeof operations === 'undefined') {
				continue
			}

			// if the result isn't an array we can just use the value
			if (typeof layerValue !== 'undefined' && !Array.isArray(layerValue)) {
				return layerValue
			}

			// if we have an operation
			if (typeof layerOperations !== 'undefined') {
				// process every operation
				for (const op of layerOperations) {
					// remove operation
					if (isRemoveOperation(op)) {
						operations.remove.push(op.id)
					}
					// inserts are sorted by location
					if (isInsertOperation(op)) {
						operations.insert[op.location].unshift(op.id)
					}
					// if we found a delete operation, we're done
					if (isDeleteOperation(op)) {
						return undefined
					}
				}
			}

			// if we don't have a value to return, we're done
			if (typeof layerValue === 'undefined') {
				continue
			}

			// if there are no operations, move along
			if (
				!operations.remove.length &&
				!operations.insert.start.length &&
				!operations.insert.end.length
			) {
				return layerValue
			}

			// we have operations to apply to the list
			return [...operations.insert.start, ...layerValue, ...operations.insert.end].filter(
				(value) => !operations.remove.includes(value as string)
			)
		}
	}

	writeLink(id: string, field: string, value: string | LinkedList) {
		// write to the top most layer
		return this.topLayer.writeLink(id, field, value)
	}

	writeField(id: string, field: string, value: GraphQLValue) {
		return this.topLayer.writeField(id, field, value)
	}

	resolveLayer(id: number): void {
		let startingIndex = null

		// find the layer with the matching id
		for (const [index, layer] of this._data.entries()) {
			if (layer.id !== id) {
				continue
			}

			// we found the target layer
			startingIndex = index - 1

			// its not optimistic any more
			this._data[index].optimistic = false

			// we're done
			break
		}

		// if we didn't find the layer, yell loudly
		if (startingIndex === null) {
			throw new Error('could not find layer with id: ' + id)
		}

		// if the starting layer is optimistic then we can't write to it
		if (this._data[startingIndex].optimistic) {
			startingIndex++
		}

		// start walking down the list of layers, applying any non-optimistic ones to the target
		const baseLayer = this._data[startingIndex]
		let layerIndex = startingIndex
		while (layerIndex < this._data.length) {
			// the layer in question
			const layer = this._data[layerIndex]

			// if the layer is optimistic, we can't go further
			if (!layer || layer.optimistic) {
				break
			}
			layerIndex++

			// apply the layer onto our base
			baseLayer.writeLayer(layer)
		}

		// delete the layers we merged
		this._data.splice(startingIndex + 1, layerIndex - startingIndex - 1)
	}

	private get topLayer(): Layer {
		// if there is no base layer
		if (this._data.length === 0) {
			this.createLayer()
		}

		// if the last layer is optimistic, create another layer on top of it
		if (this._data[this._data.length - 1]?.optimistic) {
			this.createLayer()
		}

		return this._data[this._data.length - 1]
	}
}

class Layer {
	readonly id: number
	public optimistic: boolean = false

	fields: EntityFieldMap = {}
	links: LinkMap = {}
	operations: OperationMap = {}

	constructor(id: number) {
		this.id = id
	}

	getOperations(id: string, field: string): Operation[] | undefined {
		// if the id has been deleted
		if (this.operations[id]?.deleted) {
			return [
				{
					kind: OperationKind.delete,
					target: id,
				},
			]
		}

		// there could be a mutation for the specific field
		if (this.operations[id]?.fields[field]) {
			return this.operations[id].fields[field]
		}
	}

	get(id: string, field: string): DeleteOperation | ListOperation[] | GraphQLField {
		// if its a link return the value
		if (typeof this.links[id]?.[field] !== 'undefined') {
			return this.links[id][field]
		}

		// only other option is a value
		return this.fields[id]?.[field]
	}

	writeField(id: string, field: string, value: GraphQLField) {
		this.fields[id] = {
			...this.fields[id],
			[field]: value,
		}
	}

	writeLink(id: string, field: string, value: string | LinkedList) {
		this.links[id] = {
			...this.links[id],
			[field]: value,
		}
	}

	clear() {
		this.links = {}
		this.fields = {}
		this.operations = {}
	}

	delete(id: string) {
		// add an insert operation to the map
		this.operations = {
			...this.operations,
			[id]: {
				...this.operations[id],
				deleted: true,
			},
		}
	}

	insert(id: string, field: string, where: OperationLocation, target: string) {
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

	writeLayer({ fields = {}, links = {}, operations = {} }: LayerData): void {
		// copy the field values
		for (const [id, values] of Object.entries(fields)) {
			// if we haven't seen this id before, just copy it all
			if (!this.fields[id]) {
				this.fields[id] = values
				continue
			}

			// we do have a record matching this id, copy the individual fields
			for (const [field, value] of Object.entries(values)) {
				this.fields[id][field] = value
			}
		}
		// copy the field values
		for (const [id, values] of Object.entries(links)) {
			// if we haven't seen this id before, just copy it all
			if (!this.links[id]) {
				this.links[id] = values
				continue
			}

			// we do have a record matching this id, copy the individual links
			for (const [field, value] of Object.entries(values)) {
				this.links[id][field] = value
			}
		}

		// copy the operations
		for (const [id, ops] of Object.entries(operations)) {
			const fields: OperationMap['id']['fields'] = {}

			// merge the two operation maps
			for (const opMap of [this.operations[id], ops].filter(Boolean)) {
				for (const [fieldName, operations] of Object.entries(opMap.fields || {})) {
					fields[fieldName] = [...(fields[fieldName] || []), ...operations]
				}
			}

			// only copy a field key if there is something
			if (Object.keys(fields).length > 0) {
				this.operations[id] = {
					...this.operations[id],
					fields,
				}
			}

			if (ops.deleted) {
				delete this.fields[id]
				delete this.links[id]
			}
		}
	}

	private addFieldOperation(id: string, field: string, operation: ListOperation) {
		this.operations = {
			...this.operations,
			[id]: {
				...this.operations[id],
				fields: {
					[field]: [...(this.operations[id]?.fields[field] || []), operation],
				},
			},
		}
	}
}

type GraphQLField = GraphQLValue | LinkedList

type EntityMap<_Value> = { [id: string]: { [field: string]: _Value } }

type EntityFieldMap = EntityMap<GraphQLField>

type LinkMap = EntityMap<string | null | LinkedList>

type OperationMap = {
	[id: string]: {
		deleted?: boolean
		fields: { [field: string]: ListOperation[] }
	}
}

type LayerData = { fields?: EntityFieldMap; links?: LinkMap; operations?: OperationMap }

type LinkedList<_Result = string> = (_Result | null | LinkedList<_Result>)[]

type InsertOperation = {
	kind: OperationKind.insert
	location: OperationLocation
	id: string
}

type RemoveOperation = {
	kind: OperationKind.remove
	id: string
}

type DeleteOperation = {
	kind: OperationKind.delete
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

export enum OperationLocation {
	start = 'start',
	end = 'end',
}

export enum OperationKind {
	delete = 'delete',
	insert = 'insert',
	remove = 'remove',
}
