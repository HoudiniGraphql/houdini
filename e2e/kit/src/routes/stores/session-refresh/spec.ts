import { expect, test, type Request } from '@playwright/test'

import { routes } from '../../../lib/utils/routes.js'

const initialToken = '1234-Houdini-Token-5678'
const updatedToken = 'updated-Houdini-Token-0000'

function isActiveSessionQuery(request: Request) {
	return (
		request.url().endsWith(routes.GraphQL) &&
		(request.postData()?.includes('query ActiveSessionAfterInvalidate') ?? false)
	)
}

test.describe('SvelteKit session refresh', () => {
	test('refreshes active queries with the new Houdini session', async ({ page }) => {
		const initialRequestPromise = page.waitForRequest(isActiveSessionQuery)
		await page.goto(routes.Stores_Session_Refresh)

		const initialRequest = await initialRequestPromise
		expect(initialRequest.headers().authorization).toBe(`Bearer ${initialToken}`)
		await expect(page.locator('#result')).toHaveText(initialToken)

		const [refetchRequest] = await Promise.all([
			page.waitForRequest(isActiveSessionQuery),
			page.waitForResponse((response) => response.url().endsWith('session-refresh/update')),
			page.getByRole('button', { name: 'Update session' }).click(),
		])

		expect(refetchRequest.headers().authorization).toBe(`Bearer ${updatedToken}`)
		await expect(page.locator('#result')).toHaveText(updatedToken)
	})
})
