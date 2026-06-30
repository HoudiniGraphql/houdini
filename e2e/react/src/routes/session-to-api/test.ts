import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The loop: a session updated client-side — imperatively (setSession) OR via a @session mutation —
// is the exact session the client plugin pipeline (fetchParams) sends to the api on the next
// request. requestSession echoes back what the api received, so we can assert the two match.
test('the managed session is the session the api receives (imperative + @session)', async ({
	page,
}) => {
	await goto(page, routes.session_to_api)
	await expect(page.getByTestId('local-theme')).toHaveText('(none)')

	// imperative update → the api sees it on the next request
	await page.click('[data-testid="update-imperative"]')
	await expect(page.getByTestId('local-theme')).toHaveText('set-imperatively')
	await page.click('[data-testid="ask-api"]')
	await expect(page.getByTestId('api-saw')).toHaveText('set-imperatively')

	// @session mutation update → the api sees the new value too
	await page.click('[data-testid="update-via-mutation"]')
	await expect(page.getByTestId('local-theme')).toHaveText('set-by-mutation')
	await page.click('[data-testid="ask-api"]')
	await expect(page.getByTestId('api-saw')).toHaveText('set-by-mutation')
})
