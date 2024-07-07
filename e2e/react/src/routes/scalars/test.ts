import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('Scalars', async ({ page }) => {
	await goto(page, routes.scalars)

	await expect(page.textContent('#result')).resolves.toEqual(
		'Bruce Willis-3/19/1955Samuel Jackson-12/21/1948Morgan Freeman-5/31/1937Tom Hanks-7/9/1956'
	)
})
