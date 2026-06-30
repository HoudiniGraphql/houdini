import { test } from '@playwright/test'
import { sleep } from '$lib/utils/sleep'
import { routes } from '../../../lib/utils/routes.js'
import { expect_to_be, goto_expect_n_gql } from '../../../lib/utils/testsHelper.js'

test.describe('cache @refetch in a subscription', () => {
	test('a subscription with @refetch refetches the dependent query', async ({ page }) => {
		// load the page and wait for the initial query
		await goto_expect_n_gql(page, routes.Cache_Refetch_Subscription, 1)
		await expect_to_be(page, 'Bruce Willis', 'div[id=user-name]')

		// start listening to the subscription
		await page.click('#listen')
		await sleep(100)

		// change the user on the server and publish the subscription event. neither
		// the mutation nor the subscription returns `name`, so the only way the query
		// can show the new name is by refetching — which @refetch triggers
		await page.click('#mutate')
		await sleep(300)

		await expect_to_be(page, 'Samuel Jackson', 'div[id=user-name]')
	})
})
