import { test, expect, vi, beforeEach } from 'vitest'

import { poll_remote_schema } from './schema.js'

const pull_schema = vi.fn(async () => {})

// the plugin only needs a url, an interval and the paths it writes to
vi.mock('../lib/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../lib/index.js')>()
	return {
		...actual,
		get_config: vi.fn(async () => ({
			config_file: { watchSchema: { interval: 5 } },
			api_url: async () => 'http://localhost:4000/graphql',
			schema_path: () => 'schema.graphql',
			schema_pull_headers: async () => ({}),
		})),
	}
})

vi.mock('../lib/schema.js', () => ({
	pull_schema: (...args: unknown[]) => pull_schema(...(args as [])),
}))

const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration))

beforeEach(() => {
	pull_schema.mockClear()
})

// Vite's plugin container awaits every in-flight buildStart before it runs buildEnd,
// so a buildStart that only settles once buildEnd fires deadlocks server.close():
// the poll loop waits for a signal that is waiting for the poll loop.
test('buildStart settles while the schema is still being polled', async () => {
	const plugin: any = poll_remote_schema({} as any)

	const outcome = await Promise.race([
		plugin.buildStart().then(() => 'settled'),
		sleep(200).then(() => 'pending'),
	])
	plugin.buildEnd()

	expect(outcome).toBe('settled')
})

test('buildEnd stops the poll loop', async () => {
	const plugin: any = poll_remote_schema({} as any)
	await plugin.buildStart()

	// the one pull buildStart makes before handing off to the loop
	expect(pull_schema).toHaveBeenCalledTimes(1)

	plugin.buildEnd()
	// long enough for ten more turns of the 5ms interval
	await sleep(60)

	expect(pull_schema).toHaveBeenCalledTimes(1)
})
