import { expect, test } from '@playwright/test'

// This test runs against the Vite DEV server: StrictMode double-invokes effects only in
// development builds, and that cycle (mount, simulated unmount, mount again) is exactly
// what it pins — teardown wired to "unmount" must not kill the document store while the
// component is still alive. Same dev-server spirit as the oauth and static-assets tests.
const DEV_ORIGIN = 'http://localhost:3009'

test('useQuery stays reactive under StrictMode double-invoked effects (dev)', async ({
	page,
}) => {
	await page.goto(`${DEV_ORIGIN}/use-query-strictmode`)

	await expect(page.locator('#name')).toHaveText('Bruce Willis')

	// after the double-effect cycle, a sibling mutation's cache write must still propagate
	await page.click('#update')
	await expect(page.locator('#name')).toHaveText('Updated Name')
})
