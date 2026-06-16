import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('layout that throws notFound() returns 404 without looping', async ({ page }) => {
	const response = await goto(page, routes.error_loop)
	expect(response?.status()).toBe(404)
})
