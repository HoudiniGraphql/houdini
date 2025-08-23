import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('Hello World', async ({ page }) => {
	await goto(page, routes.hello)

	await expect(page.textContent('#result')).resolves.toEqual('Hello World! // From Houdini!')
})
