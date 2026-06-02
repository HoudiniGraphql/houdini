import { expect, test } from '@playwright/test'
import { routes } from '../../lib/utils/routes.js'
import { goto } from '../../lib/utils/testsHelper.js'

test('node plugin generates file during codegen', async ({ page }) => {
	await goto(page, routes.NodePlugin)
	await expect(page.locator('#result')).toHaveText('hello from the node plugin')
})
