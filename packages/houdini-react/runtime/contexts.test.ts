import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

import * as contexts from './contexts.js'

const runtimeDir = fileURLToPath(new URL('.', import.meta.url))

function runtimeSourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) {
			return entry.name === 'node_modules' ? [] : runtimeSourceFiles(full)
		}
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
	})
}

describe('runtime React contexts', () => {
	// A React context is a module-level singleton: provider and consumer must share the
	// object returned by createContext(). When a context is created inside a module that also
	// exports components/hooks, Vite re-evaluates that module on an HMR update and mints a new
	// context object, splitting an already-mounted provider from a freshly-bound consumer
	// ("Could not find router context"). Every context therefore lives in contexts.ts, a
	// dependency-only leaf module that the HMR graph never re-evaluates. This test fails if a
	// createContext() call is reintroduced anywhere else in the runtime.
	test('createContext is only called in the contexts leaf module', () => {
		const offenders = runtimeSourceFiles(runtimeDir).filter(
			(file) =>
				!file.endsWith(`${join('runtime', 'contexts.ts')}`) &&
				readFileSync(file, 'utf-8').includes('createContext')
		)
		expect(offenders).toEqual([])
	})

	test('the leaf exports every runtime context', () => {
		for (const name of [
			'RouterContextObject',
			'LocationContext',
			'Is404Context',
			'PageContext',
			'StatusContext',
			'FormStatusContext',
		] as const) {
			expect(contexts[name]).toHaveProperty('Provider')
		}
	})
})
