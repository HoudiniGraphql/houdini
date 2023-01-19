import { Cache } from './cache'

export class StaleManager {
	cache: Cache

	// type {       "User"
	// 	id {         "User:1"
	//   field {      "id"
	// 	  number | null
	// 	 }
	//  }
	// }
	// nulls mean that the value is stale, and the number is the time that the value was set
	private fieldsTime: Map<string, Map<string, Map<string, number | null>>> = new Map()

	constructor(cache: Cache) {
		this.cache = cache
	}

	#initMapType = (type: string) => {
		if (!this.fieldsTime.get(type)) {
			this.fieldsTime.set(type, new Map())
		}
	}

	#initMapId = (type: string, id: string) => {
		this.#initMapType(type)

		if (!this.fieldsTime.get(type)!.get(id)) {
			this.fieldsTime.get(type)!.set(id, new Map())
		}
	}

	getFieldTime(type: string, id: string, field: string): number | null | undefined {
		return this.fieldsTime.get(type)?.get(id)?.get(field)
	}

	/**
	 * set the date to a field
	 * @param id User:1
	 * @param field id
	 */
	setFieldTimeToNow(type: string, id: string, field: string): void {
		this.#initMapId(type, id)
		this.fieldsTime.get(type)?.get(id)?.set(field, new Date().valueOf())
	}

	/**
	 * mark a field State
	 * @param id User:1
	 * @param field id
	 */
	markFieldStale(type: string, id: string, field: string): void {
		this.#initMapId(type, id)
		this.fieldsTime.get(type)?.get(id)?.set(field, null)
	}

	/**
	 * mark a type Stale
	 * @param type User
	 */
	markTypeStale(type: string): void {
		const fieldsTimeOfType = this.fieldsTime.get(type)

		console.log(`markTypeStale`, this.fieldsTime)
		if (fieldsTimeOfType) {
			// Go over everything we know until now and stale fields
			for (const [id, fieldMap] of fieldsTimeOfType.entries()) {
				for (const [field] of fieldMap.entries()) {
					this.markFieldStale(type, id, field)
				}
			}
		}
	}
}
