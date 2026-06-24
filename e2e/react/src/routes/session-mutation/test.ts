import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The generic relay: a plain useMutation (no form) tagged @session writes the session AND
// updates useSession() live — the sessionRelay client plugin relays the minted token to the
// auth endpoint (cookie) and mirrors the result into local state. No form, no refresh.
test('a plain useMutation updates the session live, without a refresh', async ({ page }) => {
	await goto(page, routes.session_mutation)
	await expect(page.getByTestId('session-theme')).toHaveText('(none)')

	await page.click('[data-testid="submit"]')

	// no reload — local state reflects the write immediately
	await expect(page.getByTestId('session-theme')).toHaveText('dark')
})
