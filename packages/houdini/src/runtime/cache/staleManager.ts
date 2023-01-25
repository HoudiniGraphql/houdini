import type { Cache } from './cache'

export class StaleManager {
	cache: Cache

	// type {       "User"      "User"
	// 	id {         "User:1"    "_ROOT_"
	//   field {      "id"        "viewer"
	// 	  number | undefined | null
	// 	 }
	//  }
	// }

	// number => data ok (not stale!)
	// undefined => no data (not stale!)
	// null => data stale (stale)

	// nulls mean that the value is stale, and the number is the time that the value was set
	// JYC TODO: put this private (useful for debugging now)
	fieldsTime: Map<string, Map<string, Map<string, number | null>>> = new Map()

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

	getFieldTime(type: string, id: string, field: string): number | undefined | null {
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

	markAllStale(): void {
		for (const [type, fieldTypeMap] of this.fieldsTime.entries()) {
			for (const [id, fieldMap] of fieldTypeMap.entries()) {
				for (const [field] of fieldMap.entries()) {
					this.markFieldStale(type, id, field)
				}
			}
		}
	}

	markTypeStale(type: string): void {
		const fieldsTimeOfType = this.fieldsTime.get(type)

		if (fieldsTimeOfType) {
			// Go over everything we know until now and stale fields
			for (const [id, fieldMap] of fieldsTimeOfType.entries()) {
				for (const [field] of fieldMap.entries()) {
					this.markFieldStale(type, id, field)
				}
			}
		}
	}

	markTypeFieldStale(type: string, field: string): void {
		const fieldsTimeOfType = this.fieldsTime.get(type)

		if (fieldsTimeOfType) {
			// Go over everything we know until now and stale fields
			for (const [id, fieldMap] of fieldsTimeOfType.entries()) {
				for (const [local_field] of fieldMap.entries()) {
					if (local_field === field) {
						this.markFieldStale(type, id, local_field)
					}
				}
			}
		}
	}

	markRecordFieldsStale(type: string, id: string): void {
		const fieldsTimeOfType = this.fieldsTime.get(type)

		if (fieldsTimeOfType) {
			const fieldMap = fieldsTimeOfType.get(id)

			if (fieldMap) {
				for (const [field] of fieldMap.entries()) {
					this.markFieldStale(type, id, field)
				}
			}
		}
	}

	markFieldStale(type: string, id: string, field: string): void {
		this.#initMapId(type, id)
		this.fieldsTime.get(type)?.get(id)?.set(field, null)
	}
}
