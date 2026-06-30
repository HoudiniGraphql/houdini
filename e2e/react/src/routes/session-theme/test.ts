import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// @session(merge: true): a mutation upserts a preference into the session, keeping the rest.
// Logging in first, then setting a theme, must end with BOTH the logged-in user and the theme —
// proving the write merged rather than replaced.
test('merge upserts a preference, keeping the logged-in session', async ({ page }) => {
	// establish a session that carries a user
	await goto(page, routes.auth_form)
	await page.fill('[data-testid="username-input"]', 'alice')
	await page.click('[data-testid="submit"]')
	await page.waitForURL(/\/auth-form\/done/)

	// navigate to the preference route — the session persists across the SPA navigation
	await goto(page, routes.session_theme)
	await expect(page.getByTestId('session-user')).toHaveText('alice')
	await expect(page.getByTestId('session-theme')).toHaveText('(none)')

	// set the theme — merges { theme } in without clobbering the user
	await page.click('[data-testid="submit"]')
	await expect(page.getByTestId('session-theme')).toHaveText('dark')
	await expect(page.getByTestId('session-user')).toHaveText('alice')
})
