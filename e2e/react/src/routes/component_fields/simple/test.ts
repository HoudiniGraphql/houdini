import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('Component field happy path', async ({ page }) => {
	await goto(page, routes.componentFields_simple)

	// find all of the images
	const images = await page.locator('img').all()
	// every image should have a size of 50
	for (const image of images) {
		expect(await image.getAttribute('height')).toBe('30')
		expect(await image.getAttribute('src')).not.toContain('size=')
	}
})
