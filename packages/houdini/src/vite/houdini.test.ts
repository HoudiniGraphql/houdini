import { test, expect, vi, beforeEach } from 'vitest'

import { testConfig } from '../test/index.js'
import { houdini } from './houdini.js'

// init_db removes and recreates the orchestration SQLite file. We mock it so we can assert
// *whether* it runs without touching the real filesystem — the behavior #1703 hinges on.
vi.mock('../lib/codegen.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../lib/codegen.js')>()
	return {
		...actual,
		init_db: vi.fn(async () => [{ __mock: 'db' } as any, '/tmp/houdini-test.db'] as const),
	}
})

async function run_config_resolved(isWorker: boolean) {
	const { init_db } = await import('../lib/codegen.js')
	const ctx: any = { config: testConfig(), db: undefined }
	const plugin = houdini(ctx)
	await (plugin as any).configResolved({ isWorker })
	return { ctx, init_db }
}

beforeEach(async () => {
	const { init_db } = await import('../lib/codegen.js')
	;(init_db as any).mockClear()
})

// Regression test for #1703: with the plugin enabled for both the main and worker build
// pipelines, the worker pipeline must not open/recreate the orchestration DB (doing so races
// the main build and throws a disk I/O error).
test('worker builds do not open the orchestration database', async () => {
	const { ctx, init_db } = await run_config_resolved(true)
	expect(init_db).not.toHaveBeenCalled()
	expect(ctx.db).toBeUndefined()
})

test('non-worker builds open the orchestration database', async () => {
	const { ctx, init_db } = await run_config_resolved(false)
	expect(init_db).toHaveBeenCalledTimes(1)
	expect(ctx.db).toEqual({ __mock: 'db' })
})
