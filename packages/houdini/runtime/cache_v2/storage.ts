class DataStorage {
	constructor() {
		// when the storage layer is initialized we need to connect to the
		// browser's IndexDB instance and hold onto the reference
		if (!window.indexedDB) {
			throw new Error(
				"Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available."
			)
		}
	}
}

// polyfill the IndexDB objects
window.indexedDB =
	// @ts-ignore
	window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
window.IDBTransaction = window.IDBTransaction ||
	// @ts-ignore
	window.webkitIDBTransaction ||
	// @ts-ignore
	window.msIDBTransaction || { READ_WRITE: 'readwrite' }
// @ts-ignore
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange
