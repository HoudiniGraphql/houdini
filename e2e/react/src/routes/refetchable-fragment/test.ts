import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_1_gql, expectToContain, goto } from '~/utils/testsHelper.js'

test.describe('refetchable fragment', () => {
	test('refetch re-runs the fragment with new arguments', async ({ page }) => {
		await goto(page, routes.refetchable_fragment)

		// the fragment loads with the default size argument
		await expectToContain(page, '?size=50', 'div[id=result]')

		// the `param` argument (passed via @with) drives testField
		await expectToContain(page, 'Hello world', 'div[id=merge]')

		// refetching with a new size hits the network and swaps in the result
		await expect_1_gql(page, 'button[id=refetch]')

		await expectToContain(page, '?size=100', 'div[id=result]')

		// refetch only changed `size`; the previously-set `param` must be preserved (merge)
		await expectToContain(page, 'Hello world', 'div[id=merge]')

		// refetching again with a different size works and replaces the result
		await expect_1_gql(page, 'button[id=refetch-large]')

		await expectToContain(page, '?size=200', 'div[id=result]')
	})
})
