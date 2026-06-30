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
