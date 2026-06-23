import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The generic relay: a plain useMutation (no form) tagged @session still writes the session.
// The sessionRelay client plugin relays the minted token to the auth endpoint, so the cookie
// is set. Local state isn't mirrored for a bare useMutation, so we reload to read the cookie
// back through SSR — if it's there, the relay fired without any form involved.
test('a plain useMutation writes the session through the generic relay', async ({ page }) => {
	await goto(page, routes.session_mutation)
	await expect(page.getByTestId('session-theme')).toHaveText('(none)')

	// click and wait for the relay POST to the auth endpoint to land before navigating
	const relay = page.waitForResponse(
		(r) => r.url().includes('/auth/token') && r.request().method() === 'POST'
	)
	await page.click('[data-testid="submit"]')
	await relay

	// the cookie is now set; read the session back through SSR
	await page.reload()
	await expect(page.getByTestId('session-theme')).toHaveText('dark')
})
