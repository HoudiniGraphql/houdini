import path from 'node:path'
import { test, expect, describe } from 'vitest'

import { resolveAssetPath, resolvePublicPath } from './assets.js'

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

	test('ignores query strings (cache busting)', () => {
		expect(resolveAssetPath('/assets/entries/app.js?v=123', BUILD)).toBe(
			path.join(BUILD, 'assets', 'entries', 'app.js')
		)
	})

	test('decodes percent-encoded names (spaces in public files)', () => {
		expect(resolveAssetPath('/assets/bunny%20man.png', BUILD)).toBe(
			path.join(BUILD, 'assets', 'bunny man.png')
		)
	})

	test('refuses percent-encoded traversal', () => {
		expect(resolveAssetPath('/assets/%2e%2e/ssr/entries/adapter.js', BUILD)).toBe(null)
	})

	test('refuses malformed percent-encoding', () => {
		expect(resolveAssetPath('/assets/%zz.png', BUILD)).toBe(null)
	})
})

describe('resolvePublicPath (public file manifest confinement)', () => {
	const PUBLIC = new Set(['/robots.txt', '/.well-known/apple-app-site-association'])

	test('serves a file named in the manifest', () => {
		expect(resolvePublicPath('/robots.txt', BUILD, PUBLIC)).toBe(path.join(BUILD, 'robots.txt'))
	})

	test('serves extensionless manifest entries', () => {
		expect(resolvePublicPath('/.well-known/apple-app-site-association', BUILD, PUBLIC)).toBe(
			path.join(BUILD, '.well-known', 'apple-app-site-association')
		)
	})

	test('ignores query strings', () => {
		expect(resolvePublicPath('/robots.txt?v=1', BUILD, PUBLIC)).toBe(
			path.join(BUILD, 'robots.txt')
		)
	})

	test('refuses anything not in the manifest — the server bundle shares the build root', () => {
		expect(resolvePublicPath('/index.js', BUILD, PUBLIC)).toBe(null)
		expect(resolvePublicPath('/ssr/entries/adapter.js', BUILD, PUBLIC)).toBe(null)
		expect(resolvePublicPath('/../etc/passwd', BUILD, PUBLIC)).toBe(null)
	})

	test('refuses encoded aliases of manifest entries pointing elsewhere', () => {
		// decodes to '/robots.txt/../index.js' — not a manifest entry, refused
		expect(resolvePublicPath('/robots.txt%2F..%2Findex.js', BUILD, PUBLIC)).toBe(null)
	})
})
