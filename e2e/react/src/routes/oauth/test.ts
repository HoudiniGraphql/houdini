import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The full first-class OAuth round-trip in a real browser: clicking loginURL walks
// /login -> stub /authorize -> Houdini callback (code exchange + profile + onSignIn) -> /oauth,
// which then carries the session established from the stub user.
test('first-class OAuth establishes the session through the provider round-trip', async ({
	page,
}) => {
	await goto(page, routes.oauth)
	await page.click('[data-testid="login"]')
	await page.waitForURL(/\/oauth$/)
	await expect(page.getByTestId('who')).toHaveText('stub@example.com')
	await expect(page.getByTestId('user-id')).toHaveText('stub-user-1')
})

// The SAME round-trip, but against the Vite DEV server (port 3009) instead of the production
// adapter. The dev path runs through a hand-rolled node<->fetch bridge in houdini-react's vite
// plugin, and every header/cookie bug we've hit has lived ONLY there while the production adapter
// (whatwg-node) stayed correct:
//   - inbound GET requests dropped their headers, so the callback couldn't read the txn cookie
//   - outbound duplicate Set-Cookie headers were merged, so the burned txn cookie's Max-Age=0
//     attached to the session cookie and the browser deleted the session on arrival
// Both regress as "click login, land back on the login link" — exactly what this asserts against.
// The unit-level router tests can't catch these: they call the handlers with well-formed fetch
// objects, flying over the bridge where the bugs are.
const DEV_ORIGIN = 'http://localhost:3009'

test('first-class OAuth establishes the session through the dev-server bridge', async ({ page }) => {
	await goto(page, `${DEV_ORIGIN}${routes.oauth}`)
	await page.click('[data-testid="login"]')
	await page.waitForURL(`${DEV_ORIGIN}/oauth`)

	// the session survived the callback's Set-Cookie round-trip (the merged-cookie bug deleted it)
	await expect(page.getByTestId('who')).toHaveText('stub@example.com')
	await expect(page.getByTestId('user-id')).toHaveText('stub-user-1')

	// and it actually persists as a cookie: a fresh navigation still reads the session back,
	// proving the Set-Cookie was written intact rather than clobbered by the txn-cookie burn
	await goto(page, `${DEV_ORIGIN}${routes.oauth}`)
	await expect(page.getByTestId('user-id')).toHaveText('stub-user-1')
})
