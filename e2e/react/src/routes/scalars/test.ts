import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('Scalars', async ({ page }) => {
	await goto(page, routes.scalars)

	expect(page.textContent('#result')).toMatchSnapshot()
})
