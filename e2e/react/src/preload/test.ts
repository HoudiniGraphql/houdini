import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dataUsers } from 'e2e-api/graphql.mjs'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The layout's nav links opt in to preloading (data-houdini-preload), but a plain
// playwright click moves the mouse and clicks in one motion, faster than the 20ms hover
// timer that triggers the preload. Hovering first (and giving the preloaded requests time
// to land) exercises the click-after-preload path, where the navigation finds the
// destination's component and data already cached instead of loading them itself.
async function preloadThenClick(page: Page, name: string) {
	const link = page.getByRole('link', { name, exact: true })
	await link.hover()
	await page.waitForTimeout(500)
	await link.click()
}

test('clicking a link after its preload has landed', async ({ page }) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))

	await goto(page, '/')
	await preloadThenClick(page, 'hello')

	await expect(page.locator('#result')).toHaveText('Hello World! // From Houdini!')
	expect(errors).toEqual([])
})

test('preloaded navigation between pages with different variables', async ({ page }) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))

	await goto(page, routes.handle_1)
	await expect(page.locator('#result')).toHaveText(dataUsers[0].avatarURL)

	await preloadThenClick(page, 'handle_2')

	await expect(page.locator('#result')).toHaveText(dataUsers[1].avatarURL)
	expect(errors).toEqual([])
})
