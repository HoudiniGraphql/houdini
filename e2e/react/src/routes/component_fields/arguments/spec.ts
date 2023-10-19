import { expect, test } from '@playwright/test'
import { goto } from '~/utils/testsHelper.js'

test('Component fields with correct argument value', async ({ page }) => {
	await goto(page, '/component_fields/arguments')

	// find all of the images
	const images = await page.locator('img').all()
	// every image should have a size of 50
	for (const image of images) {
		expect(await image.getAttribute('height')).toBe('50')
		expect(await image.getAttribute('src')).toContain('size=50')
	}
})
