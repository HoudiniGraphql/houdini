import { expect, test } from '@playwright/test'
import { routes } from '../../lib/utils/routes.js'
import { goto } from '../../lib/utils/testsHelper.js'

test('@plural fragment renders the whole list through a single fragment()', async ({ page }) => {
	await goto(page, routes.Plural_fragment)
	const result = await page.locator('#result').textContent({ timeout: 2997 })
	expect(result).toEqual(`Bruce WillisSamuel JacksonMorgan FreemanTom Hanks`)
})
