import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('useFragment throws when a non-plural fragment is handed a list of references', async ({
	page,
}) => {
	await goto(page, routes.plural_fragment_guard)

	// the runtime guard should fire with a clear message
	await expect(page.locator('body')).toContainText('not marked @plural')
})
