import { computeKey } from '../lib'
import type { Cache } from './cache'

export class StaleManager {
	cache: Cache

	// 	id {         "User:1"    "_ROOT_"
	//   field {      "id"        "viewer"
	// 	  number | undefined | null
	// 	 }
	//  }

	// number => data ok (not stale!)
	// undefined => no data (not stale!)
	// null => data stale (stale)

	// nulls mean that the value is stale, and the number is the time that the value was set
	private fieldsTime: Map<string, Map<string, number | null>> = new Map()

	constructor(cache: Cache) {
		this.cache = cache
	}

	#initMapId = (id: string) => {
		if (!this.fieldsTime.get(id)) {
			this.fieldsTime.set(id, new Map())
		}
	}

	/**
	 * get the FieldTime info
	 * @param id User:1
	 * @param field firstName
	 */
	getFieldTime(id: string, field: string): number | undefined | null {
		return this.fieldsTime.get(id)?.get(field)
	}

	/**
	 * set the date to a field
	 * @param id User:1
	 * @param field firstName
	 */
	setFieldTimeToNow(id: string, field: string): void {
		this.#initMapId(id)
		this.fieldsTime.get(id)?.set(field, new Date().valueOf())
	}

	/**
	 * set null to a field (stale)
	 * @param id User:1
	 * @param field firstName
	 */
	markFieldStale(id: string, field: string): void {
		this.#initMapId(id)
		this.fieldsTime.get(id)?.set(field, null)
	}

	markAllStale(): void {
		for (const [id, fieldMap] of this.fieldsTime.entries()) {
			for (const [field] of fieldMap.entries()) {
				this.markFieldStale(id, field)
			}
		}
	}

	markRecordStale(id: string): void {
		const fieldsTimeOfType = this.fieldsTime.get(id)
		if (fieldsTimeOfType) {
			for (const [field] of fieldsTimeOfType.entries()) {
				this.markFieldStale(id, field)
			}
		}
	}

	markTypeStale(type: string): void {
		for (const [id, fieldMap] of this.fieldsTime.entries()) {
			// if starts lile `User:` (it will catch `User:1` for example)
			if (id.startsWith(`${type}:`)) {
				for (const [field] of fieldMap.entries()) {
					this.markFieldStale(id, field)
				}
			}
		}
	}

	markTypeFieldStale(type: string, field: string, when?: {}): void {
		const key = computeKey({ field, args: when })

		for (const [id, fieldMap] of this.fieldsTime.entries()) {
			// if starts with `User:` (it will catch `User:1` for example)
			if (id.startsWith(`${type}:`)) {
				for (const local_field of fieldMap.keys()) {
					if (local_field === key) {
						this.markFieldStale(id, field)
					}
				}
			}
		}
	}

	// clean up the stale manager
	delete(id: string, field: string) {
		if (this.fieldsTime.has(id)) {
			this.fieldsTime.get(id)?.delete(field)
			if (this.fieldsTime.get(id)?.size === 0) {
				this.fieldsTime.delete(id)
			}
		}
	}

	reset() {
		this.fieldsTime.clear()
	}
}
