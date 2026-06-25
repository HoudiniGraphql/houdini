import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

// Guard against server-only config leaking into the client-served bundle. src/server/+config.ts
// holds the session signing keys and OAuth client secret; it is compiled into the server bundle
// (build/ssr) only. adapter-node serves build/assets to the browser, so nothing under it may
// contain those secrets. This is a structural invariant — the client and server builds go to
// separate directories and the adapter only exposes the client one — so this test reads the built
// output from disk rather than driving a browser.
//
// The sentinels mirror the values in e2e/react/src/server/+config.ts.
const SECRETS = ['supersecret', 'stub-secret']

const assetsDir = path.resolve('build/assets')

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name)
		return entry.isDirectory() ? walk(full) : [full]
	})
}

test('server secrets never reach the client-served assets bundle', () => {
	// the build must have run (playwright's `tests` script builds first)
	expect(existsSync(assetsDir)).toBe(true)

	const offenders: string[] = []
	for (const file of walk(assetsDir)) {
		const contents = readFileSync(file, 'utf8')
		for (const secret of SECRETS) {
			if (contents.includes(secret)) {
				offenders.push(`${path.relative(assetsDir, file)} contains "${secret}"`)
			}
		}
	}

	expect(offenders, `secret leaked into client bundle:\n${offenders.join('\n')}`).toEqual([])

	// the server adapter entry imports +config; it must not be emitted into the client dir
	expect(existsSync(path.join(assetsDir, 'entries', 'adapter.js'))).toBe(false)
})
