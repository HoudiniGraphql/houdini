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

	get(id: string, field: string): GraphQLField {
		// go through the list of layers in reverse
		for (let i = this._data.length - 1; i >= 0; i--) {
			const layerValue = this._data[i].get(id, field)

			if (typeof layerValue !== 'undefined') {
				return layerValue
			}
		}
	}

	write(id: string, field: string, value: GraphQLField) {
		// if there is no base layer
		if (this._data.length === 0) {
			this.createLayer()
		}

		// if the last layer is optimistic, create another layer
		if (this._data[this._data.length - 1]?.optimistic) {
			this.createLayer()
		}

		// write to the top most layer
		return this._data[this._data.length - 1].write(id, field, value)
	}

	resolveLayer(id: number, values: LayerData): void {
		// find the layer with the matching id
		for (const [index, layer] of this._data.entries()) {
			if (layer.id !== id) {
				continue
			}

			// copy the new values onto the layer
			layer.writeLayer(values)
			// and mark it as a resolved layer
			layer.optimistic = false

			// before we merge the values down to the lower layer, lets walk up the list and
			// look for more non-optimistic layers we should merge with this one
			let nextUnoptimisticIndex
			for (
				nextUnoptimisticIndex = index + 1;
				nextUnoptimisticIndex < this._data.length;
				nextUnoptimisticIndex++
			) {
				const nextLayer = this._data[nextUnoptimisticIndex]
				// if this layer is optimistic, we're done looking for more layers to merge
				if (!nextLayer || nextLayer.optimistic) {
					break
				}

				// the layer is not optimistic, save its value and remove it from the list
				layer.writeLayer(nextLayer)
			}

			// before we delete the layers, we might have to include this one if the layer below us is also
			// optimistic
			let startingIndex = index + 1
			if (!this._data[index - 1]?.optimistic) {
				this._data[index - 1].writeLayer(layer)
				startingIndex--
			}

			// delete the layers we merged
			this._data.splice(startingIndex, nextUnoptimisticIndex - startingIndex + 1)
		}
	}
}

class Layer {
	readonly id: number
	public optimistic: boolean = false

	fields: EntityFieldMap = {}
	links: LinkMap = {}

	constructor(id: number) {
		this.id = id
	}

	get(id: string, field: string): GraphQLField {
		// if its a link return the value
		if (typeof this.links[id]?.[field] !== 'undefined') {
			return this.links[id][field]
		}

		// only other option is a value
		return this.fields[id]?.[field]
	}

	write(id: string, field: string, value: GraphQLField) {
		// if we were given a link
		if (isLink(value)) {
			this.links[id] = {
				...this.links[id],
				[field]: value,
			}

			// we're done
			return
		}

		// the value is not a link, register it as a field value
		this.fields[id] = {
			...this.fields[id],
			[field]: value,
		}
	}

	writeLayer({ fields, links }: LayerData): void {
		// copy the field values
		for (const [id, values] of Object.entries(fields || {})) {
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
		for (const [id, values] of Object.entries(links || {})) {
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
	}
}

type Link = { to: string }

export function link(to: string) {
	return { to }
}

export function isLink(field: GraphQLField): field is Link {
	return Boolean((field as any)?.to)
}

type GraphQLField = GraphQLValue | Link

type EntityFieldMap = { [id: string]: { [field: string]: GraphQLValue } }

type LinkMap = { [id: string]: { [field: string]: Link | null | LinkedList<Link> } }

type LayerData = { fields?: EntityFieldMap; links?: LinkMap }

type LinkedList<_Result = string> = (_Result | null | LinkedList<_Result>)[]
