import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { plugin as runPlugin, PluginError } from './index.js'

// ─── module mocks (hoisted) ───────────────────────────────────────────────────

vi.mock('ws', () => ({
	WebSocketServer: class {
		on() {}
	},
}))
vi.mock('../lib/db.js', () => ({
	openDb: async () => ({
		run() {},
		get() { return undefined },
		all() { return [] },
		exec() {},
		rowsModified() { return 0 },
		flush() {},
		reload() {},
		close() {},
		filepath: ':memory:',
	}),
}))

// readline mock: each test can push lines into `stdinLines` to simulate stdin
const stdinEmitter = new EventEmitter()
vi.mock('node:readline', () => ({
	createInterface: () => stdinEmitter,
}))

// ─── helpers ──────────────────────────────────────────────────────────────────

function captureStdout() {
	const lines: any[] = []
	const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
		const text = typeof chunk === 'string' ? chunk : chunk.toString()
		text.split('\n')
			.filter(Boolean)
			.forEach((l: string) => {
				lines.push(JSON.parse(l))
			})
		return true
	})
	return { lines, restore: () => spy.mockRestore() }
}

function useStdioTransport() {
	const original = process.argv
	process.argv = ['node', 'plugin.js', '--transport', 'stdio']
	return () => {
		process.argv = original
	}
}

// ─── PluginError ──────────────────────────────────────────────────────────────

describe('PluginError', () => {
	test('is an Error with message', () => {
		const err = new PluginError({ message: 'bad thing' })
		expect(err).toBeInstanceOf(Error)
		expect(err.message).toBe('bad thing')
	})

	test('stores detail, locations and kind', () => {
		const err = new PluginError({
			message: 'invalid',
			detail: 'missing field',
			locations: [{ filepath: 'src/foo.ts', line: 10, column: 4 }],
			kind: 'validation',
		})
		expect(err.detail).toBe('missing field')
		expect(err.locations).toEqual([{ filepath: 'src/foo.ts', line: 10, column: 4 }])
		expect(err.kind).toBe('validation')
	})
})

// ─── stdio: register message ──────────────────────────────────────────────────

describe('runPlugin stdio — register message', () => {
	let restoreArgv: () => void

	beforeEach(() => {
		restoreArgv = useStdioTransport()
	})
	afterEach(() => {
		restoreArgv()
		stdinEmitter.removeAllListeners()
		vi.restoreAllMocks()
	})

	test('writes register message with PascalCase hook names', () => {
		const { lines, restore } = captureStdout()

		runPlugin({
			name: 'my-plugin',
			order: 'after',
			hooks: {
				validate: async () => {},
				afterLoad: async () => {},
			},
		})

		restore()

		expect(lines).toHaveLength(1)
		const reg = lines[0]
		expect(reg.type).toBe('register')
		expect(reg.name).toBe('my-plugin')
		expect(reg.order).toBe('after')
		expect(reg.hooks).toContain('Validate')
		expect(reg.hooks).toContain('AfterLoad')
		expect(reg.hooks).not.toContain('validate')
		expect(reg.hooks).not.toContain('afterLoad')
	})

	test('only lists hooks that are functions', () => {
		const { lines, restore } = captureStdout()

		runPlugin({
			name: 'selective',
			order: 'before',
			hooks: {
				schema: async () => {},
				// validate intentionally omitted
			},
		})

		restore()

		const reg = lines[0]
		expect(reg.hooks).toEqual(['Schema'])
	})
})

// ─── stdio: request → response ────────────────────────────────────────────────

describe('runPlugin stdio — request/response', () => {
	let restoreArgv: () => void

	beforeEach(() => {
		restoreArgv = useStdioTransport()
	})
	afterEach(() => {
		restoreArgv()
		stdinEmitter.removeAllListeners()
		vi.restoreAllMocks()
	})

	test('dispatches request and writes response', async () => {
		const { lines, restore } = captureStdout()

		runPlugin({
			name: 'responder',
			order: 'after',
			hooks: {
				schema: async () => ({ sdl: 'type Query { _ping: Boolean }' }),
			},
		})

		// send a request after the register message
		stdinEmitter.emit(
			'line',
			JSON.stringify({ id: 'r-1', type: 'request', hook: 'Schema', payload: {} })
		)

		// give the async handler time to complete
		await new Promise((r) => setTimeout(r, 20))
		restore()

		const response = lines.find((m) => m.type === 'response')
		expect(response).toBeDefined()
		expect(response.id).toBe('r-1')
		expect(response.error).toBeUndefined()
		expect(response.result).toEqual({ sdl: 'type Query { _ping: Boolean }' })
	})

	test('returns error response for unknown hook', async () => {
		const { lines, restore } = captureStdout()

		runPlugin({
			name: 'limited',
			order: 'after',
			hooks: { schema: async () => {} },
		})

		stdinEmitter.emit(
			'line',
			JSON.stringify({ id: 'r-2', type: 'request', hook: 'Validate', payload: {} })
		)
		await new Promise((r) => setTimeout(r, 20))
		restore()

		const response = lines.find((m) => m.type === 'response' && m.id === 'r-2')
		expect(response?.error).toBeDefined()
	})

	test('serializes PluginError with detail and locations', async () => {
		const { lines, restore } = captureStdout()

		runPlugin({
			name: 'thrower',
			order: 'after',
			hooks: {
				validate: async () => {
					throw new PluginError({
						message: 'bad doc',
						detail: 'extra info',
						locations: [{ filepath: 'src/a.ts', line: 5 }],
					})
				},
			},
		})

		stdinEmitter.emit(
			'line',
			JSON.stringify({ id: 'r-3', type: 'request', hook: 'Validate', payload: {} })
		)
		await new Promise((r) => setTimeout(r, 20))
		restore()

		const response = lines.find((m) => m.id === 'r-3')
		expect(response?.error?.message).toBe('bad doc')
		expect(response?.error?.detail).toBe('extra info')
		expect(response?.error?.locations).toEqual([{ filepath: 'src/a.ts', line: 5 }])
	})
})
