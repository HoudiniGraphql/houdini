import { computeKey } from '../key.js'
import type { Cache } from './index.js'

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

	// snapshots that arrived via hydration and haven't been registered yet. field times
	// are normally recorded per write, but hydration assigns whole layers at once and has
	// to stay O(1) — so we hold onto the snapshot and only materialize its field times
	// when a mark* actually needs them (staleness marks are rare; hydration happens on
	// every page load). until then a hydrated field reads as "no entry", exactly how it
	// read before any mark existed.
	private pendingHydrated: HydratedSnapshot[] = []

	constructor(cache: Cache) {
		this.cache = cache
	}

	// note a hydrated snapshot whose fields should participate in staleness. O(1): the
	// per-field registration is deferred to the first mark* call (see #flushHydrated)
	registerHydration(snapshot: HydratedSnapshot) {
		this.pendingHydrated.push(snapshot)
	}

	#flushHydrated() {
		if (this.pendingHydrated.length === 0) {
			return
		}
		const now = Date.now()
		for (const snapshot of this.pendingHydrated) {
			for (const source of [snapshot.fields, snapshot.links]) {
				for (const [id, fields] of Object.entries(source ?? {})) {
					this.#initMapId(id)
					const map = this.fieldsTime.get(id)!
					for (const field of Object.keys(fields)) {
						// explicit writes (and marks) since hydration win over the snapshot
						if (!map.has(field)) {
							map.set(field, now)
						}
					}
				}
			}
		}
		this.pendingHydrated = []
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
		this.fieldsTime.get(id)?.set(field, Date.now())
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
		this.#flushHydrated()
		for (const [id, fieldMap] of this.fieldsTime.entries()) {
			for (const [field] of fieldMap.entries()) {
				this.markFieldStale(id, field)
			}
		}
	}

	markRecordStale(id: string): void {
		this.#flushHydrated()
		const fieldsTimeOfType = this.fieldsTime.get(id)
		if (fieldsTimeOfType) {
			for (const [field] of fieldsTimeOfType.entries()) {
				this.markFieldStale(id, field)
			}
		}
	}

	markTypeStale(type: string): void {
		this.#flushHydrated()
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
		this.#flushHydrated()
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

	// remove every entry associated with a record
	deleteRecord(id: string) {
		this.fieldsTime.delete(id)
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
		this.pendingHydrated = []
	}
}

// the only thing registration needs from a hydrated snapshot is which fields each
// record carries
type HydratedSnapshot = {
	fields?: Record<string, Record<string, unknown>>
	links?: Record<string, Record<string, unknown>>
}
