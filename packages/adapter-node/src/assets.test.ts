import path from 'node:path'
import { test, expect, describe } from 'vitest'

import { resolveAssetPath } from './assets.js'

const BUILD = path.join(path.sep, 'app', 'build')

describe('resolveAssetPath (static asset path confinement)', () => {
	test('serves a normal asset under build/assets', () => {
		expect(resolveAssetPath('/assets/entries/app.js', BUILD)).toBe(
			path.join(BUILD, 'assets', 'entries', 'app.js')
		)
	})

	test('refuses traversal into the server bundle (build/ssr holds the session keys)', () => {
		expect(resolveAssetPath('/assets/../ssr/entries/adapter.js', BUILD)).toBe(null)
	})

	test('refuses traversal out of the build directory entirely', () => {
		expect(resolveAssetPath('/assets/../../../../etc/passwd', BUILD)).toBe(null)
	})

	test('refuses a request that resolves to the build root itself', () => {
		expect(resolveAssetPath('/assets/..', BUILD)).toBe(null)
	})

	test('allows the assets root', () => {
		expect(resolveAssetPath('/assets', BUILD)).toBe(path.join(BUILD, 'assets'))
	})
})
