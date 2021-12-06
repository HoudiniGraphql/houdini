import { GraphQLValue } from '../types'

export class DataStorage {
	private _layers: LayerStorage

	constructor() {
		// when the data storage is initialized we need to pick the appropriate
		// layer solution
		this._layers = new InMemoryLayers()
	}
}

interface LayerStorage extends Iterable<EntityFieldMap> {
	writeLayer(values: EntityFieldMap, resolved: boolean): number
	resolveLayer(id: number, values: EntityFieldMap): void
}

class InMemoryLayers implements LayerStorage {
	private _data: { id: number; values: EntityFieldMap; resolved: boolean }[]

	constructor() {
		this._data = []
	}

	writeLayer(values: EntityFieldMap, resolved: boolean): number {
		// generate an id for the new layer
		const id = new Date().getTime() + Math.random()

		// add the layer to the list
		this._data.push({ id, values, resolved })

		// if we are writing a resolved layer that's not the first, go ahead and resolve it immediately
		if (resolved && this._data.length > 1) {
			this.resolveLayer(id, values)
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
			// look for more resolved layers we should merge with this one
			let nextUnresolvedIndex
			for (
				nextUnresolvedIndex = index + 1;
				nextUnresolvedIndex < this._data.length;
				nextUnresolvedIndex++
			) {
				const nextLayer = this._data[nextUnresolvedIndex]

				// if this layer is not resolved, we're done looking for more layers to merge
				if (!nextLayer?.resolved) {
					break
				}

				// the layer is resolved, save its value and remove it from the list
				this.mergeLayers(newValue, nextLayer.values)
			}

			// merge all of the layers into this one
			layer.values = newValue

			// before we layers, we might have to include this one if the layer below us is also
			// resolved
			let startingIndex = index + 1
			if (this._data[index - 1].resolved) {
				this.mergeLayers(this._data[index - 1].values, layer.values)
				startingIndex--
			}

			// delete the layers we merged
			this._data.splice(startingIndex, nextUnresolvedIndex - startingIndex + 1)
		}
	}

	// the list of layers goes from "top" to "bottom" (last layer, to the base)
	*[Symbol.iterator]() {
		for (let i = this._data.length - 1; i >= 0; i--) {
			yield this._data[i].values
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
