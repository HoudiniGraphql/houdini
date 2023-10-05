import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { goto, waitForConsole } from '~/utils/testsHelper.js'

test('No console logs', async ({ page }) => {
	try {
		const [msg] = await Promise.all([
			waitForConsole(page, 'warning'),
			goto(page, routes['features/component_fields/arguments']),
		])

		expect('to throw an error').toBe('so we should never see this')
	} catch (error) {
		if (error instanceof Error) {
			// Great, We didn't have any logs.
			expect(error.name).toBe('TimeoutError')
		}
	}
})
