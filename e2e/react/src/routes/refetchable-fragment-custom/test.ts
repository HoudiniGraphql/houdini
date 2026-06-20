import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_1_gql, expectToContain, goto } from '~/utils/testsHelper.js'

test.describe('refetchable fragment (custom resolve)', () => {
	test('refetch works on a non-Node type resolved by a custom query', async ({ page }) => {
		await goto(page, routes.refetchable_fragment_custom)

		// the fragment loads with the default size argument
		await expectToContain(page, '?size=50', 'div[id=result]')

		// refetching re-runs the embedded refetchableEntity(id:) query with new arguments
		await expect_1_gql(page, 'button[id=refetch]')
		await expectToContain(page, '?size=100', 'div[id=result]')

		// a second refetch with a different size also works
		await expect_1_gql(page, 'button[id=refetch-large]')
		await expectToContain(page, '?size=200', 'div[id=result]')
	})
})
