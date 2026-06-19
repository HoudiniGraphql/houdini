import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('headers() exports are merged into the response', async ({ page }) => {
	const response = await goto(page, routes.response_headers)
	const headers = response?.headers() ?? {}

	// the layout-only header is present
	expect(headers['x-houdini-layout']).toBe('layout-value')
	// the page-only header is present
	expect(headers['x-houdini-page']).toBe('page-value')
	// on a conflict the page wins over the layout
	expect(headers['x-houdini-shared']).toBe('from-page')

	// the page still rendered normally
	await expect(page.textContent('#result')).resolves.toEqual('response headers')
})
