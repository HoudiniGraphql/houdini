import { GraphQLValue } from '../types'

export interface LayerStorage {
	write(data: { layer: EntityFieldMap; optimistic?: boolean }): number
	resolveLayer(id: number, values: EntityFieldMap): void
	read(id: string, field: string): GraphQLValue
}

export class InMemoryStorage implements LayerStorage {
	private _data: { id: number; values: EntityFieldMap; optimistic?: boolean }[]
	private idCount = 0

	constructor() {
		this._data = []
	}

	get layerCount(): number {
		return this._data.length
	}

	write({ layer, optimistic }: { layer: EntityFieldMap; optimistic?: boolean }): number {
		// generate an id for the new layer
		const id = this.idCount++

		// add the layer to the list
		this._data.push({ id, values: layer, optimistic })

		// if we are writing a optimistic layer that's not the first, go ahead and resolve it immediately
		if (!optimistic && this._data.length > 1) {
			this.resolveLayer(id, layer)
		}

		// return the id
		return id
	}

	resolveLayer(id: number, values: EntityFieldMap): void {
		// find the layer with the matching id
		for (const [index, layer] of this._data.entries()) {
			if (layer.id !== id) {
				continue
			}

			const newValue = values

			// before we merge the values down to the lower layer, lets walk up the list and
			// look for more optimistic layers we should merge with this one
			let nextUnoptimisticIndex
			for (
				nextUnoptimisticIndex = index + 1;
				nextUnoptimisticIndex < this._data.length;
				nextUnoptimisticIndex++
			) {
				const nextLayer = this._data[nextUnoptimisticIndex]

				// if this layer is optimistic, we're done looking for more layers to merge
				if (nextLayer?.optimistic) {
					break
				}

				// the layer is optimistic, save its value and remove it from the list
				this.mergeLayers(newValue, nextLayer.values)
			}

			// merge all of the layers into this one
			layer.values = newValue

			// before we layers, we might have to include this one if the layer below us is also
			// optimistic
			let startingIndex = index + 1
			if (!this._data[index - 1]?.optimistic) {
				this.mergeLayers(this._data[index - 1].values, layer.values)
				startingIndex--
			}

			// delete the layers we merged
			this._data.splice(startingIndex, nextUnoptimisticIndex - startingIndex + 1)
		}
	}

	read(id: string, field: string): GraphQLValue {
		// looking up an id's field requires looping through the layers we know about
		for (let i = this._data.length - 1; i >= 0; i--) {
			if (this._data[i].values[id][field]) {
				return this._data[i].values[id][field]
			}
		}
	}

	private mergeLayers(base: EntityFieldMap, newValues: EntityFieldMap) {
		for (const [id, values] of Object.entries(newValues)) {
			// if we haven't seen this id before, just copy it all
			if (!base[id]) {
				base[id] = values
				continue
			}

			// we do have a record matching this id, copy the individual fields
			for (const [field, value] of Object.entries(values)) {
				base[id][field] = value
			}
		}
	}
}

type EntityFieldMap = { [id: string]: { [field: string]: GraphQLValue } }

const FieldNotFoundError = new Error('field not found')
