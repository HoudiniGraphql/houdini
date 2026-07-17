import { expect, test } from '@playwright/test'

import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('devtools overlay captures client requests', async ({ page }) => {
	await goto(page, routes.devtools)

	// make sure the page rendered before interacting
	await expect(page.locator('#result')).toHaveText('Hello World! // From Houdini!')

	// fire a client-side request for the overlay to capture
	await page.click('#trigger-mutation')

	// the overlay mounts shortly after hydration; playwright locators pierce the open shadow root
	const overlay = page.locator('#houdini-devtools-overlay')
	await overlay.locator('.hdt-trigger').click()

	// the mutation shows up in the request list
	const row = overlay.locator('.hdt-row', { hasText: 'DevtoolsUpdateMutation' })
	await expect(row).toBeVisible()

	// selecting it shows its variables in the default tab
	await row.click()
	await expect(overlay.locator('.hdt-pre')).toContainText('Devtools User')
})
