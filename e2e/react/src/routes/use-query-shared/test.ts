import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// Two useQuery components with the same query+variables share one document store (they
// resolve through the same suspense identifier). This pins the store's refcounted
// lifetime: unmounting one component must not tear down the store — and its cache
// subscription — while the other still renders from it.
test('unmounting one of two identical useQuery components keeps the survivor reactive', async ({
	page,
}) => {
	// both components resolve from the single SSR fetch (hydration reads the streamed
	// cache snapshot, so no client request fires)
	await goto(page, routes.use_query_shared)

	await expect(page.locator('#name-a')).toHaveText('Bruce Willis')
	await expect(page.locator('#name-b')).toHaveText('Bruce Willis')

	// unmount the first component; the second keeps using the shared store
	await page.click('#unmount-a')
	await expect(page.locator('#name-a')).toHaveCount(0)
	await expect(page.locator('#name-b')).toHaveText('Bruce Willis')

	// a cache write must still reach the survivor
	await page.click('#update')
	await expect(page.locator('#name-b')).toHaveText('Updated Name')
})
