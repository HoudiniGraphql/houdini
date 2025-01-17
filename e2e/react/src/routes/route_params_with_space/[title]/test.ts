import { test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { expect_to_be, goto } from '~/utils/testsHelper'

test('Route params with space', async ({ page }) => {
	await goto(page, routes.route_params)

	// be default we see user 1
	await expect_to_be(page, 'Callimachus Pinakes:Callimachus Pinakes')
})
