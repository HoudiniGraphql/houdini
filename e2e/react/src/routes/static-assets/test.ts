import { expect, test } from '@playwright/test'

// The dev server's SSR middleware decides "asset request vs page navigation" before vite's
// public-directory middleware ever runs, so anything it misclassifies as a navigation gets
// swallowed by the router and rendered as a 404 page. Extensions with digits (.woff2, .mp4)
// were exactly that: the old letters-only extension check didn't match them, so fonts in
// public/ came back as HTML. The production adapter copies public/ into the build output and
// was never affected — this is a dev-bridge test, same spirit as the oauth dev-server test.
const DEV_ORIGIN = 'http://localhost:3009'

test('dev server serves public assets whose extension contains digits', async ({ request }) => {
	const response = await request.get(`${DEV_ORIGIN}/assets/fonts/test.woff2`)

	expect(response.status()).toBe(200)
	expect(response.headers()['content-type']).not.toContain('text/html')

	// the actual file bytes, not a rendered 404 page
	const body = await response.body()
	expect(body.subarray(0, 4).toString()).toBe('wOF2')
})

// control: letters-only extensions always passed through — make sure they keep working
test('dev server serves public assets with plain extensions', async ({ request }) => {
	const response = await request.get(`${DEV_ORIGIN}/assets/output.css`)

	expect(response.status()).toBe(200)
	expect(response.headers()['content-type']).toContain('css')
})

// routes whose final segment happens to contain a dot must still reach the router — this is
// why the fix filters by known mimetype instead of just allowing any dotted suffix
test('dev server still routes paths with unknown dotted suffixes', async ({ request }) => {
	const response = await request.get(`${DEV_ORIGIN}/route.does.not.exist.v1.2`)

	// the router answers (here: its 404 page), rather than vite failing to find a file
	expect(response.headers()['content-type']).toContain('text/html')
})

// public files with no extension at all (/.well-known/...) can't be identified by mimetype —
// the dev middleware has to check whether the path actually exists in public/
test('dev server serves extensionless public files', async ({ request }) => {
	const response = await request.get(`${DEV_ORIGIN}/.well-known/apple-app-site-association`)

	expect(response.status()).toBe(200)
	expect(await response.text()).toContain('applinks')
})

// --- the production adapter (baseURL, port 3008) ---
// the build copies public/ into the output root, next to the server bundle. the node adapter
// only special-cases /assets/*, so anything else from public/ used to fall through to the
// router, and its content-type switch only knew six extensions.

test('production server serves digit-extension assets with the right content-type', async ({
	request,
}) => {
	const response = await request.get('/assets/fonts/test.woff2')

	expect(response.status()).toBe(200)
	expect(response.headers()['content-type']).toBe('font/woff2')

	const body = await response.body()
	expect(body.subarray(0, 4).toString()).toBe('wOF2')
})

test('production server serves root-level public files', async ({ request }) => {
	const response = await request.get('/robots.txt')

	expect(response.status()).toBe(200)
	expect(await response.text()).toContain('User-agent')
})

test('production server serves extensionless public files', async ({ request }) => {
	const response = await request.get('/.well-known/apple-app-site-association')

	expect(response.status()).toBe(200)
	expect(await response.text()).toContain('applinks')
})

// the server bundle shares the output root with the copied public files — serving public
// files must not open a path to it
test('production server does not expose the server bundle', async ({ request }) => {
	for (const url of ['/index.js', '/ssr/entries/adapter.js', '/assets/../index.js']) {
		const response = await request.get(url)
		const type = response.headers()['content-type'] ?? ''
		// either the router's 404 page or a plain not-found — never javascript source
		expect(type, url).not.toContain('javascript')
	}
})
