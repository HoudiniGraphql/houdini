import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('node plugin generates file during codegen', async ({ page }) => {
	await goto(page, routes.node_plugin)
	await expect(page.locator('#result')).toHaveText('hello from the node plugin')
})
