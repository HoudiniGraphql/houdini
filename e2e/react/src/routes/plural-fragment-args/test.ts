import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('@plural fragment with @arguments renders the list with the field argument applied', async ({
	page,
}) => {
	await goto(page, routes.plural_fragment_args)

	// the whole list renders through one useFragment, and the per-item avatarURL(size:) field
	// (driven by @arguments/@with) resolves for every row
	await expect(page.locator('#plural-list li')).toHaveCount(4)
	await expect(page.getByTestId('plural_args:1')).toContainText('Bruce Willis')

	const images = await page.locator('#plural-list img').all()
	expect(images.length).toBe(4)
	for (const image of images) {
		expect(await image.getAttribute('src')).toBeTruthy()
	}
})
