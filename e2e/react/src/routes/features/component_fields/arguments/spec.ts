import { test } from '@playwright/test'
import { goto } from '~/utils/testsHelper.js'

test('Renders fragments with correct argument value', async ({ page }) => {
	await goto(page, '/features/component_fields/arguments')

	console.log(await page.innerHTML('body'))
})
