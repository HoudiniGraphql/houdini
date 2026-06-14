import { bench, describe } from 'vitest'

import { testConfigFile } from '../../../test/index.js'
import { RefetchUpdateMode } from '../../types.js'
import type { SubscriptionSelection, SubscriptionSpec } from '../../types.js'
import { Cache } from '../index.js'

// ---------------------------------------------------------------------------
// Category filter
//
// Pass BENCH=<category>[,<category>...] to run only certain suites.
// Omit BENCH (or set BENCH=all) to run everything.
//
// Categories:
//   core          — write and read at various sizes (fastest, ~30s)
//   subscriptions — write→notify, subscribe/unsubscribe, churn
//   lists         — list mutations, applyUpdates / pagination
//   multi-doc     — fan-out, shared records, overlapping selections
//   optimistic    — optimistic write + layer resolve
//   gc            — garbage-collector tick, stale marking
//   ssr           — serialize / hydrate
//
// Quick mode (BENCH_QUICK=1): every benchmark runs with minimal iterations so
// the whole suite finishes in under a minute. Use this during local dev to
// catch obvious regressions without waiting for a full statistical run.
//
// Examples:
//   BENCH=core vitest bench ...
//   BENCH=core,subscriptions vitest bench ...
//   BENCH_QUICK=1 vitest bench ...
//   BENCH=core BENCH_QUICK=1 vitest bench ...
// ---------------------------------------------------------------------------
const activeCategories = new Set(
	(process.env.BENCH ?? 'all')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
)
const skip = (...cats: string[]) =>
	!activeCategories.has('all') && !cats.some((c) => activeCategories.has(c))

// In quick mode every bench is capped at 3 iterations (1 warmup) regardless
// of the per-bench options — enough to catch crashes and gross regressions.
const QUICK = process.env.BENCH_QUICK === '1'
type BenchArgs = Parameters<typeof bench>
const b: typeof bench = (QUICK
	? (name: BenchArgs[0], fn: BenchArgs[1], _opts?: BenchArgs[2]) =>
			bench(name, fn as () => void, {
				time: 0,
				iterations: 3,
				warmupTime: 0,
				warmupIterations: 1,
			})
	: (name: BenchArgs[0], fn: BenchArgs[1], opts?: BenchArgs[2]) =>
			bench(name, fn as () => void, {
				time: 2000,
				warmupTime: 500,
				warmupIterations: 5,
				...opts,
			})) as unknown as typeof bench

const config = testConfigFile()

// A flat selection of a single record with a handful of scalar fields.
const flatSelection: SubscriptionSelection = {
	fields: {
		viewer: {
			type: 'User',
			visible: true,
			keyRaw: 'viewer',
			selection: {
				fields: {
					id: { type: 'ID', visible: true, keyRaw: 'id' },
					firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
					lastName: { type: 'String', visible: true, keyRaw: 'lastName' },
					email: { type: 'String', visible: true, keyRaw: 'email' },
					age: { type: 'Int', visible: true, keyRaw: 'age' },
				},
			},
		},
	},
}

const flatData = {
	viewer: {
		id: '1',
		firstName: 'Bob',
		lastName: 'Smith',
		email: 'bob@example.com',
		age: 42,
	},
}

// A nested selection: viewer → friends list → each friend's profile.
const nestedSelection: SubscriptionSelection = {
	fields: {
		viewer: {
			type: 'User',
			visible: true,
			keyRaw: 'viewer',
			selection: {
				fields: {
					id: { type: 'ID', visible: true, keyRaw: 'id' },
					firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
						selection: {
							fields: {
								id: { type: 'ID', visible: true, keyRaw: 'id' },
								firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
								email: { type: 'String', visible: true, keyRaw: 'email' },
							},
						},
					},
				},
			},
		},
	},
}

function makeFriends(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		id: String(i + 2),
		firstName: `Friend${i}`,
		email: `friend${i}@example.com`,
	}))
}

// A wide selection: one record with many scalar fields.
function makeWideSelection(n: number): SubscriptionSelection {
	const fields: SubscriptionSelection['fields'] = {
		id: { type: 'ID', visible: true, keyRaw: 'id' },
	}
	for (let i = 0; i < n; i++) {
		fields[`field${i}`] = { type: 'String', visible: true, keyRaw: `field${i}` }
	}
	return {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: { fields },
			},
		},
	}
}

function makeWideData(n: number) {
	const record: Record<string, string> = { id: '1' }
	for (let i = 0; i < n; i++) {
		record[`field${i}`] = `value${i}`
	}
	return { viewer: record }
}

const wideSelection10 = makeWideSelection(10)
const wideSelection100 = makeWideSelection(100)
const wideSelection1000 = makeWideSelection(1000)
const wideSelection10000 = makeWideSelection(10000)

const wideData10 = makeWideData(10)
const wideData100 = makeWideData(100)
const wideData1000 = makeWideData(1000)
const wideData10000 = makeWideData(10000)

// Reusable single-record selection — used by GC, stale, and disjoint benchmarks.
// Module-level so the WeakMap in getFieldsForType hits on every call.
const idFirstNameSelection: SubscriptionSelection = {
	fields: {
		id: { type: 'ID', visible: true, keyRaw: 'id' },
		firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
	},
}

// 100 per-field selections for the overlapping-specs benchmark.
// Pre-generated so the same object references are reused across bench iterations.
const overlappingSelections100: SubscriptionSelection[] = Array.from(
	{ length: 100 },
	(_, i): SubscriptionSelection => ({
		fields: {
			id: { type: 'ID', visible: true, keyRaw: 'id' },
			[`field${i}`]: { type: 'String', visible: true, keyRaw: `field${i}` },
		},
	})
)

// A list of wide records: rows items each with cols scalar fields.
// Total data volume = rows * cols, letting us compare shapes at the same total size.
function makeWideListSelection(cols: number): SubscriptionSelection {
	const itemFields: SubscriptionSelection['fields'] = {
		id: { type: 'ID', visible: true, keyRaw: 'id' },
	}
	for (let i = 0; i < cols; i++) {
		itemFields[`field${i}`] = { type: 'String', visible: true, keyRaw: `field${i}` }
	}
	return {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: { type: 'ID', visible: true, keyRaw: 'id' },
						items: {
							type: 'Item',
							visible: true,
							keyRaw: 'items',
							selection: { fields: itemFields },
						},
					},
				},
			},
		},
	}
}

function makeWideListData(rows: number, cols: number) {
	const items = Array.from({ length: rows }, (_, r) => {
		const record: Record<string, string> = { id: String(r + 2) }
		for (let c = 0; c < cols; c++) {
			record[`field${c}`] = `r${r}c${c}`
		}
		return record
	})
	return { viewer: { id: '1', items } }
}

// ~1000 total cells at different aspect ratios
const wideList10x100Selection = makeWideListSelection(100)
const wideList100x10Selection = makeWideListSelection(10)
const wideList10x100Data = makeWideListData(10, 100)
const wideList100x10Data = makeWideListData(100, 10)

// ~10000 total cells at different aspect ratios
const wideList10x1000Selection = makeWideListSelection(1000)
const wideList100x100Selection = makeWideListSelection(100)
const wideList1000x10Selection = makeWideListSelection(10)
const wideList10x1000Data = makeWideListData(10, 1000)
const wideList100x100Data = makeWideListData(100, 100)
const wideList1000x10Data = makeWideListData(1000, 10)

const nestedData10 = { viewer: { id: '1', firstName: 'Bob', friends: makeFriends(10) } }
const nestedData100 = { viewer: { id: '1', firstName: 'Bob', friends: makeFriends(100) } }
const nestedData1000 = { viewer: { id: '1', firstName: 'Bob', friends: makeFriends(1000) } }
const nestedData10000 = { viewer: { id: '1', firstName: 'Bob', friends: makeFriends(10000) } }

describe.skipIf(skip('core'))('write', () => {
	b('flat record', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })
	})

	b('nested list (10 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData10 })
	})

	b('nested list (100 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData100 })
	})

	b('nested list (1000 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData1000 })
	})

	b('nested list (10000 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData10000 })
	})

	b('wide record (10 fields)', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideSelection10, data: wideData10 })
	})

	b('wide record (100 fields)', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideSelection100, data: wideData100 })
	})

	b('wide record (1000 fields)', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideSelection1000, data: wideData1000 })
	})

	b(
		'wide record (10000 fields)',
		() => {
			const cache = new Cache(config)
			cache.write({ selection: wideSelection10000, data: wideData10000 })
		},
		{ warmupIterations: 1, warmupTime: 0, iterations: 5 }
	)

	b('repeated writes to same record', () => {
		const cache = new Cache(config)
		for (let i = 0; i < 10; i++) {
			cache.write({ selection: flatSelection, data: flatData })
		}
	})
})

// ~1000 and ~10000 total cells split across rows×cols at different aspect ratios.
// Isolates whether cost is driven by record count, field count, or total cells.
describe.skipIf(skip('core'))('write — wide list (same total cells, different shape)', () => {
	b('~1000 cells: 10 rows × 100 cols', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideList10x100Selection, data: wideList10x100Data })
	})

	b('~1000 cells: 100 rows × 10 cols', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideList100x10Selection, data: wideList100x10Data })
	})

	b('~10000 cells: 10 rows × 1000 cols', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideList10x1000Selection, data: wideList10x1000Data })
	})

	b('~10000 cells: 100 rows × 100 cols', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideList100x100Selection, data: wideList100x100Data })
	})

	b('~10000 cells: 1000 rows × 10 cols', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideList1000x10Selection, data: wideList1000x10Data })
	})
})

describe.skipIf(skip('core'))('read', () => {
	b('flat record', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })
		cache.read({ selection: flatSelection })
	})

	b('nested list (10 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData10 })
		cache.read({ selection: nestedSelection })
	})

	b('nested list (100 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData100 })
		cache.read({ selection: nestedSelection })
	})

	b('nested list (1000 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData1000 })
		cache.read({ selection: nestedSelection })
	})

	b(
		'nested list (10000 items)',
		() => {
			const cache = new Cache(config)
			cache.write({ selection: nestedSelection, data: nestedData10000 })
			cache.read({ selection: nestedSelection })
		},
		{ warmupIterations: 1, warmupTime: 0, iterations: 5 }
	)
})

describe.skipIf(skip('subscriptions'))('write + notify subscribers', () => {
	b('1 subscriber, flat record', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })

		const spec: SubscriptionSpec = {
			rootType: 'Query',
			selection: flatSelection,
			onMessage: () => {},
		}
		cache.subscribe(spec)
		cache.write({ selection: flatSelection, data: flatData })
		cache.unsubscribe(spec)
	})

	b('10 subscribers, flat record', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })

		const specs: SubscriptionSpec[] = Array.from({ length: 10 }, () => ({
			rootType: 'Query',
			selection: flatSelection,
			onMessage: () => {},
		}))
		for (const s of specs) cache.subscribe(s)
		cache.write({ selection: flatSelection, data: flatData })
		for (const s of specs) cache.unsubscribe(s)
	})

	b('1 subscriber, nested list (100 items)', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData100 })

		const spec: SubscriptionSpec = {
			rootType: 'Query',
			selection: nestedSelection,
			onMessage: () => {},
		}
		cache.subscribe(spec)
		cache.write({ selection: nestedSelection, data: nestedData100 })
		cache.unsubscribe(spec)
	})
})

// Measures only write→onMessage latency. Each variant pre-builds the cache and
// subscriber once so the bench loop body is purely the write + notification dispatch.
function subscribedCache(selection: SubscriptionSelection, data: unknown) {
	const cache = new Cache(config)
	cache.write({ selection, data: data as any })
	cache.subscribe({ rootType: 'Query', selection, onMessage: () => {} })
	return cache
}

describe.skipIf(skip('subscriptions'))('write → subscriber notification', () => {
	const cacheFlat = subscribedCache(flatSelection, flatData)
	b('flat record', () => {
		cacheFlat.write({ selection: flatSelection, data: flatData })
	})

	const cacheNested10 = subscribedCache(nestedSelection, nestedData10)
	b('nested list (10 items)', () => {
		cacheNested10.write({ selection: nestedSelection, data: nestedData10 })
	})

	const cacheNested100 = subscribedCache(nestedSelection, nestedData100)
	b('nested list (100 items)', () => {
		cacheNested100.write({ selection: nestedSelection, data: nestedData100 })
	})

	const cacheNested1000 = subscribedCache(nestedSelection, nestedData1000)
	b('nested list (1000 items)', () => {
		cacheNested1000.write({ selection: nestedSelection, data: nestedData1000 })
	})

	const cacheNested10000 = subscribedCache(nestedSelection, nestedData10000)
	b(
		'nested list (10000 items)',
		() => {
			cacheNested10000.write({ selection: nestedSelection, data: nestedData10000 })
		},
		{ time: 0, iterations: 10, warmupTime: 0, warmupIterations: 1 }
	)

	const cacheWide100 = subscribedCache(wideSelection100, wideData100)
	b('wide record (100 fields)', () => {
		cacheWide100.write({ selection: wideSelection100, data: wideData100 })
	})

	const cacheWide1000 = subscribedCache(wideSelection1000, wideData1000)
	b('wide record (1000 fields)', () => {
		cacheWide1000.write({ selection: wideSelection1000, data: wideData1000 })
	})

	const cacheWide10000 = subscribedCache(wideSelection10000, wideData10000)
	b(
		'wide record (10000 fields)',
		() => {
			cacheWide10000.write({ selection: wideSelection10000, data: wideData10000 })
		},
		{ time: 0, iterations: 5, warmupTime: 0, warmupIterations: 1 }
	)

	const cacheList10x1000 = subscribedCache(wideList10x1000Selection, wideList10x1000Data)
	b(
		'~10000 cells: 10 rows × 1000 cols',
		() => {
			cacheList10x1000.write({
				selection: wideList10x1000Selection,
				data: wideList10x1000Data,
			})
		},
		{ time: 0, iterations: 5, warmupTime: 0, warmupIterations: 1 }
	)

	const cacheList100x100 = subscribedCache(wideList100x100Selection, wideList100x100Data)
	b('~10000 cells: 100 rows × 100 cols', () => {
		cacheList100x100.write({ selection: wideList100x100Selection, data: wideList100x100Data })
	})

	const cacheList1000x10 = subscribedCache(wideList1000x10Selection, wideList1000x10Data)
	b('~10000 cells: 1000 rows × 10 cols', () => {
		cacheList1000x10.write({ selection: wideList1000x10Selection, data: wideList1000x10Data })
	})
})

// ---------------------------------------------------------------------------
// Multi-document scenarios
// ---------------------------------------------------------------------------

// N specs watching the same selection. Measures pure dispatch fan-out cost:
// does notifying N subscribers scale linearly with N?
function fanOutCache(n: number): { cache: Cache; specs: SubscriptionSpec[] } {
	const cache = new Cache(config)
	cache.write({ selection: nestedSelection, data: nestedData100 })
	const specs = Array.from({ length: n }, () => ({
		rootType: 'Query',
		selection: nestedSelection,
		onMessage: () => {},
	}))
	for (const s of specs) cache.subscribe(s)
	return { cache, specs }
}

describe.skipIf(skip('multi-doc'))(
	'fan-out: N documents watching same selection (100-item list)',
	() => {
		const f1 = fanOutCache(1)
		b('1 document', () => {
			f1.cache.write({ selection: nestedSelection, data: nestedData100 })
		})

		const f10 = fanOutCache(10)
		b('10 documents', () => {
			f10.cache.write({ selection: nestedSelection, data: nestedData100 })
		})

		const f100 = fanOutCache(100)
		b('100 documents', () => {
			f100.cache.write({ selection: nestedSelection, data: nestedData100 })
		})

		const f1000 = fanOutCache(1000)
		b('1000 documents', () => {
			f1000.cache.write({ selection: nestedSelection, data: nestedData100 })
		})
	}
)

// One record (User:1) appears as the target of N different query roots.
// Each root has its own subscription spec. Writing User:1 notifies all N.
function sharedRecordCache(n: number): { cache: Cache; updateSelection: SubscriptionSelection } {
	const cache = new Cache(config)

	// Each query root points to the same underlying User:1.
	// We model this by writing viewer→User:1 for each "query" using a unique keyRaw per root.
	for (let i = 0; i < n; i++) {
		const sel: SubscriptionSelection = {
			fields: {
				[`query${i}`]: {
					type: 'User',
					visible: true,
					keyRaw: `query${i}`,
					selection: {
						fields: {
							id: { type: 'ID', visible: true, keyRaw: 'id' },
							firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
							email: { type: 'String', visible: true, keyRaw: 'email' },
						},
					},
				},
			},
		}
		cache.write({
			selection: sel,
			data: { [`query${i}`]: { id: '1', firstName: 'Bob', email: 'bob@example.com' } },
		})
		cache.subscribe({ rootType: 'Query', selection: sel, onMessage: () => {} })
	}

	// Writing directly to the shared record triggers all N subscribers.
	const updateSelection: SubscriptionSelection = {
		fields: {
			id: { type: 'ID', visible: true, keyRaw: 'id' },
			firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
			email: { type: 'String', visible: true, keyRaw: 'email' },
		},
	}
	return { cache, updateSelection }
}

describe.skipIf(skip('multi-doc'))('shared record: User:1 referenced from N query roots', () => {
	const s1 = sharedRecordCache(1)
	b('1 query root', () => {
		s1.cache.write({
			selection: s1.updateSelection,
			data: { id: '1', firstName: 'Alice', email: 'alice@example.com' },
			parent: 'User:1',
		})
	})

	const s10 = sharedRecordCache(10)
	b('10 query roots', () => {
		s10.cache.write({
			selection: s10.updateSelection,
			data: { id: '1', firstName: 'Alice', email: 'alice@example.com' },
			parent: 'User:1',
		})
	})

	const s100 = sharedRecordCache(100)
	b('100 query roots', () => {
		s100.cache.write({
			selection: s100.updateSelection,
			data: { id: '1', firstName: 'Alice', email: 'alice@example.com' },
			parent: 'User:1',
		})
	})

	const s1000 = sharedRecordCache(1000)
	b('1000 query roots', () => {
		s1000.cache.write({
			selection: s1000.updateSelection,
			data: { id: '1', firstName: 'Alice', email: 'alice@example.com' },
			parent: 'User:1',
		})
	})
})

// N subscriptions watching different fields of the same record vs N subscriptions
// watching entirely different records. Tells us whether field-level overlap adds overhead.
function overlapCache(n: number): Cache {
	const cache = new Cache(config)
	// Write N users
	for (let i = 0; i < n; i++) {
		cache.write({
			selection: {
				fields: {
					id: { type: 'ID', visible: true, keyRaw: 'id' },
					[`field${i}`]: { type: 'String', visible: true, keyRaw: `field${i}` },
				},
			},
			data: { id: String(i + 1), [`field${i}`]: `value${i}` },
			parent: `User:${i + 1}`,
		})
	}
	return cache
}

describe.skipIf(skip('multi-doc'))('overlapping vs disjoint selections (N=100)', () => {
	// All N specs watch the same record User:1 but request different fields
	b('overlapping: N specs, same record, different fields', () => {
		const cache = new Cache(config)
		cache.write({ selection: wideSelection100, data: wideData100 })
		const specs = overlappingSelections100.map((sel) => {
			const spec = { rootType: 'Query', selection: sel, onMessage: () => {} }
			cache.subscribe(spec, {})
			return { spec }
		})
		cache.write({ selection: wideSelection100, data: wideData100 })
		for (const { spec } of specs) cache.unsubscribe(spec)
	})

	// Each of N specs watches a completely different record
	b('disjoint: N specs, N different records, same field', () => {
		const cache = new Cache(config)
		const specs = Array.from({ length: 100 }, (_, i) => {
			cache.write({
				selection: idFirstNameSelection,
				data: { id: String(i + 1), firstName: `User${i}` },
				parent: `User:${i + 1}`,
			})
			const spec = { rootType: 'Query', selection: idFirstNameSelection, onMessage: () => {} }
			cache.subscribe(spec, {})
			return { spec }
		})
		// Write to one record — should only notify 1 of the 100 subscribers
		cache.write({
			selection: idFirstNameSelection,
			data: { id: '1', firstName: 'Alice' },
			parent: 'User:1',
		})
		for (const { spec } of specs) cache.unsubscribe(spec)
	})
})

// A list query + individual detail queries per item. Writing one item should
// notify both the list subscriber and that item's detail subscriber.
function listPlusDetailCache(n: number): { cache: Cache; updateSel: SubscriptionSelection } {
	const cache = new Cache(config)
	const friends = makeFriends(n)

	// List query subscribing to all N items
	cache.write({
		selection: nestedSelection,
		data: { viewer: { id: '1', firstName: 'Bob', friends } },
	})
	cache.subscribe({ rootType: 'Query', selection: nestedSelection, onMessage: () => {} })

	// Detail query for each item
	const detailFields: SubscriptionSelection = {
		fields: {
			id: { type: 'ID', visible: true, keyRaw: 'id' },
			firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
			email: { type: 'String', visible: true, keyRaw: 'email' },
		},
	}
	for (const friend of friends) {
		cache.subscribe(
			{ rootType: 'Query', selection: detailFields, onMessage: () => {} },
			{ parentID: `User:${friend.id}` }
		)
	}

	const updateSel: SubscriptionSelection = {
		fields: {
			id: { type: 'ID', visible: true, keyRaw: 'id' },
			firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
			email: { type: 'String', visible: true, keyRaw: 'email' },
		},
	}
	return { cache, updateSel }
}

describe.skipIf(skip('multi-doc'))(
	'list query + detail queries: write one item notifies both',
	() => {
		const ld10 = listPlusDetailCache(10)
		b('10-item list + 10 detail docs', () => {
			ld10.cache.write({
				selection: ld10.updateSel,
				data: { id: '2', firstName: 'Alice', email: 'alice@example.com' },
				parent: 'User:2',
			})
		})

		const ld100 = listPlusDetailCache(100)
		b('100-item list + 100 detail docs', () => {
			ld100.cache.write({
				selection: ld100.updateSel,
				data: { id: '2', firstName: 'Alice', email: 'alice@example.com' },
				parent: 'User:2',
			})
		})

		const ld1000 = listPlusDetailCache(1000)
		b('1000-item list + 1000 detail docs', () => {
			ld1000.cache.write({
				selection: ld1000.updateSel,
				data: { id: '2', firstName: 'Alice', email: 'alice@example.com' },
				parent: 'User:2',
			})
		})
	}
)

describe.skipIf(skip('subscriptions'))('subscribe / unsubscribe', () => {
	b('subscribe then unsubscribe (flat)', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })

		const spec: SubscriptionSpec = {
			rootType: 'Query',
			selection: flatSelection,
			onMessage: () => {},
		}
		cache.subscribe(spec)
		cache.unsubscribe(spec)
	})
})

// ---------------------------------------------------------------------------
// applyUpdates — pagination append
// ---------------------------------------------------------------------------

const appendSelection: SubscriptionSelection = {
	fields: {
		viewer: {
			type: 'User',
			visible: true,
			keyRaw: 'viewer',
			selection: {
				fields: {
					id: { type: 'ID', visible: true, keyRaw: 'id' },
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
						updates: [RefetchUpdateMode.append],
						selection: {
							fields: {
								id: { type: 'ID', visible: true, keyRaw: 'id' },
								firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
								email: { type: 'String', visible: true, keyRaw: 'email' },
							},
						},
					},
				},
			},
		},
	},
}

describe.skipIf(skip('lists'))('write — applyUpdates append (pagination)', () => {
	b('append page of 10 to 100-item list', () => {
		const cache = new Cache(config)
		cache.write({
			selection: appendSelection,
			data: { viewer: { id: '1', friends: makeFriends(100) } },
		})
		cache.write({
			selection: appendSelection,
			data: { viewer: { id: '1', friends: makeFriends(10) } },
			applyUpdates: ['append'],
		})
	})

	b('append page of 100 to 1000-item list', () => {
		const cache = new Cache(config)
		cache.write({
			selection: appendSelection,
			data: { viewer: { id: '1', friends: makeFriends(1000) } },
		})
		cache.write({
			selection: appendSelection,
			data: { viewer: { id: '1', friends: makeFriends(100) } },
			applyUpdates: ['append'],
		})
	})
})

// ---------------------------------------------------------------------------
// List mutations — append / prepend / remove via cache.list()
// ---------------------------------------------------------------------------

const listSelection: SubscriptionSelection = {
	fields: {
		viewer: {
			type: 'User',
			visible: true,
			keyRaw: 'viewer',
			selection: {
				fields: {
					id: { type: 'ID', visible: true, keyRaw: 'id' },
					friends: {
						type: 'User',
						visible: true,
						keyRaw: 'friends',
						list: { name: 'All_Users', connection: false, type: 'User' },
						selection: {
							fields: {
								id: { type: 'ID', visible: true, keyRaw: 'id' },
								firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
							},
						},
					},
				},
			},
		},
	},
}

const listItemSelection: SubscriptionSelection = {
	fields: {
		id: { type: 'ID', visible: true, keyRaw: 'id' },
		firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
	},
}

function makeListCache(n: number): Cache {
	const cache = new Cache(config)
	cache.write({
		selection: listSelection,
		data: { viewer: { id: '1', friends: makeFriends(n) } },
	})
	cache.subscribe({ rootType: 'Query', selection: listSelection, onMessage: () => {} })
	return cache
}

describe.skipIf(skip('lists'))('list mutations', () => {
	b('append to 10-item list', () => {
		const cache = makeListCache(10)
		cache
			.list('All_Users')
			.append({ selection: listItemSelection, data: { id: '9999', firstName: 'New' } })
	})

	b('append to 100-item list', () => {
		const cache = makeListCache(100)
		cache
			.list('All_Users')
			.append({ selection: listItemSelection, data: { id: '9999', firstName: 'New' } })
	})

	b('append to 1000-item list', () => {
		const cache = makeListCache(1000)
		cache
			.list('All_Users')
			.append({ selection: listItemSelection, data: { id: '9999', firstName: 'New' } })
	})

	b('prepend to 100-item list', () => {
		const cache = makeListCache(100)
		cache
			.list('All_Users')
			.prepend({ selection: listItemSelection, data: { id: '9999', firstName: 'New' } })
	})

	b('remove from 10-item list', () => {
		const cache = makeListCache(10)
		cache.list('All_Users').remove({ id: '2' })
	})

	b('remove from 100-item list', () => {
		const cache = makeListCache(100)
		cache.list('All_Users').remove({ id: '2' })
	})

	b('remove from 1000-item list', () => {
		const cache = makeListCache(1000)
		cache.list('All_Users').remove({ id: '2' })
	})
})

// ---------------------------------------------------------------------------
// Optimistic write + resolve
// ---------------------------------------------------------------------------

describe.skipIf(skip('optimistic'))('optimistic write + resolve', () => {
	b('flat record', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })
		cache.subscribe({ rootType: 'Query', selection: flatSelection, onMessage: () => {} })

		const layer = cache._internal_unstable.storage.createLayer(true)
		cache.write({
			selection: flatSelection,
			data: {
				viewer: {
					id: '1',
					firstName: 'Optimistic',
					lastName: 'Smith',
					email: 'o@example.com',
					age: 0,
				},
			},
			layer: layer.id,
		})
		cache.clearLayer(layer.id)
	})

	b('100-item list', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData100 })
		cache.subscribe({ rootType: 'Query', selection: nestedSelection, onMessage: () => {} })

		const layer = cache._internal_unstable.storage.createLayer(true)
		cache.write({ selection: nestedSelection, data: nestedData100, layer: layer.id })
		cache.clearLayer(layer.id)
	})

	b('1000-item list', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData1000 })
		cache.subscribe({ rootType: 'Query', selection: nestedSelection, onMessage: () => {} })

		const layer = cache._internal_unstable.storage.createLayer(true)
		cache.write({ selection: nestedSelection, data: nestedData1000, layer: layer.id })
		cache.clearLayer(layer.id)
	})
})

// ---------------------------------------------------------------------------
// GC tick
// ---------------------------------------------------------------------------

// Write N records without subscribing so they all land in the lifetime map,
// then measure one GC pass over all of them.
describe.skipIf(skip('gc'))('GC tick (unsubscribed records)', () => {
	b('100 records', () => {
		const cache = new Cache(config)
		for (let i = 0; i < 100; i++) {
			cache.write({
				selection: idFirstNameSelection,
				data: { id: String(i), firstName: `User${i}` },
				parent: `User:${i}`,
			})
		}
		cache._internal_unstable.collectGarbage()
	})

	b('1000 records', () => {
		const cache = new Cache(config)
		for (let i = 0; i < 1000; i++) {
			cache.write({
				selection: idFirstNameSelection,
				data: { id: String(i), firstName: `User${i}` },
				parent: `User:${i}`,
			})
		}
		cache._internal_unstable.collectGarbage()
	})

	b('10000 records', () => {
		const cache = new Cache(config)
		for (let i = 0; i < 10000; i++) {
			cache.write({
				selection: idFirstNameSelection,
				data: { id: String(i), firstName: `User${i}` },
				parent: `User:${i}`,
			})
		}
		cache._internal_unstable.collectGarbage()
	})
})

// ---------------------------------------------------------------------------
// Stale marking
// ---------------------------------------------------------------------------

function populatedCache(n: number): Cache {
	const cache = new Cache(config)
	for (let i = 0; i < n; i++) {
		cache.write({
			selection: idFirstNameSelection,
			data: { id: String(i), firstName: `User${i}` },
			parent: `User:${i}`,
		})
	}
	return cache
}

describe.skipIf(skip('gc'))('stale marking', () => {
	const cache100 = populatedCache(100)
	b('markAllStale (100 records)', () => {
		cache100.markTypeStale()
	})

	const cache1000 = populatedCache(1000)
	b('markAllStale (1000 records)', () => {
		cache1000.markTypeStale()
	})

	const cache10000 = populatedCache(10000)
	b('markAllStale (10000 records)', () => {
		cache10000.markTypeStale()
	})

	b('markTypeStale User (100 records)', () => {
		cache100.markTypeStale({ type: 'User' })
	})

	b('markTypeStale User (1000 records)', () => {
		cache1000.markTypeStale({ type: 'User' })
	})
})

// ---------------------------------------------------------------------------
// Subscribe / unsubscribe churn — simulates component mount/unmount cycles
// ---------------------------------------------------------------------------

describe.skipIf(skip('subscriptions'))('subscribe/unsubscribe churn', () => {
	b('10 cycles, flat record', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })
		for (let i = 0; i < 10; i++) {
			const spec: SubscriptionSpec = {
				rootType: 'Query',
				selection: flatSelection,
				onMessage: () => {},
			}
			cache.subscribe(spec)
			cache.write({ selection: flatSelection, data: flatData })
			cache.unsubscribe(spec)
		}
	})

	b('100 cycles, flat record', () => {
		const cache = new Cache(config)
		cache.write({ selection: flatSelection, data: flatData })
		for (let i = 0; i < 100; i++) {
			const spec: SubscriptionSpec = {
				rootType: 'Query',
				selection: flatSelection,
				onMessage: () => {},
			}
			cache.subscribe(spec)
			cache.write({ selection: flatSelection, data: flatData })
			cache.unsubscribe(spec)
		}
	})

	b('10 cycles, 100-item list', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData100 })
		for (let i = 0; i < 10; i++) {
			const spec: SubscriptionSpec = {
				rootType: 'Query',
				selection: nestedSelection,
				onMessage: () => {},
			}
			cache.subscribe(spec)
			cache.write({ selection: nestedSelection, data: nestedData100 })
			cache.unsubscribe(spec)
		}
	})
})

// ---------------------------------------------------------------------------
// Serialize / hydrate (SSR path)
// ---------------------------------------------------------------------------

const serialized100 = (() => {
	const cache = new Cache(config)
	cache.write({ selection: nestedSelection, data: nestedData100 })
	return cache.serialize()
})()

const serialized1000 = (() => {
	const cache = new Cache(config)
	cache.write({ selection: nestedSelection, data: nestedData1000 })
	return cache.serialize()
})()

const parsed100 = JSON.parse(serialized100)
const parsed1000 = JSON.parse(serialized1000)

describe.skipIf(skip('ssr'))('serialize', () => {
	b('100-item list', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData100 })
		cache.serialize()
	})

	b('1000-item list', () => {
		const cache = new Cache(config)
		cache.write({ selection: nestedSelection, data: nestedData1000 })
		cache.serialize()
	})
})

describe.skipIf(skip('ssr'))('hydrate', () => {
	b('100-item list', () => {
		const cache = new Cache(config)
		cache.hydrate(parsed100)
	})

	b('1000-item list', () => {
		const cache = new Cache(config)
		cache.hydrate(parsed1000)
	})
})
