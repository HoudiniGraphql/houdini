import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// Enhanced path: with JS, onSubmit runs the login mutation, relays the signed session token to
// the auth endpoint (which sets the cookie), then navigates to the redirect. The session payload
// is a whole user object — useSession() reads back login.session.user.
test('enhanced login establishes the session', async ({ page }) => {
	await goto(page, routes.auth_form)

	// the form carries the signed CSRF token (proves the round-trip is wired)
	await expect(page.locator('input[name="__houdini_csrf"]')).toHaveCount(1)

	await page.fill('[data-testid="username-input"]', 'alice')
	await page.click('[data-testid="submit"]')
	await page.waitForURL(/\/auth-form\/done/)

	// local session updates immediately (no reload) — useSession reflects the new session right
	// after the enhanced submit, mirroring the cookie the token relay set
	await expect(page.getByTestId('session-user')).toHaveText('alice')
})

// No-JS path: the same form submits natively, the server runs the mutation, sets the session
// cookie from login.session, and 303s to the redirect — no client JS involved.
test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false })

	test('no-JS login establishes the session and redirects', async ({ page }) => {
		await page.goto(routes.auth_form)
		await page.fill('[data-testid="username-input"]', 'bob')
		await page.click('[data-testid="submit"]')
		await page.waitForURL(/\/auth-form\/done/)
		await expect(page.getByTestId('session-user')).toHaveText('bob')
	})

	test('no-JS logout clears the session', async ({ page }) => {
		// establish a session first
		await page.goto(routes.auth_form)
		await page.fill('[data-testid="username-input"]', 'carol')
		await page.click('[data-testid="submit"]')
		await page.waitForURL(/\/auth-form\/done/)
		await expect(page.getByTestId('session-user')).toHaveText('carol')

		// the logout form is a native POST that deletes the cookie and redirects back
		await page.click('[data-testid="logout"]')
		await page.waitForURL(/\/auth-form$/)
		await expect(page.getByTestId('session-user')).toHaveText('(none)')
	})
})

// CSRF: a cross-origin native login POST is rejected fail-closed by the Origin check.
test('rejects a cross-origin login POST', async ({ request }) => {
	const res = await request.post(routes.auth_form, {
		headers: {
			origin: 'http://evil.example',
			'content-type': 'application/x-www-form-urlencoded',
		},
		data: '__houdini_form=Login&username=mallory',
		maxRedirects: 0,
	})
	expect(res.status()).toBe(403)
})
