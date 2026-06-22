import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The enhanced path: with JS, onSubmit intercepts, runs the mutation client-side, and
// navigates to the interpolated @endpoint redirect.
test('enhanced submit runs the mutation and navigates to the redirect', async ({ page }) => {
	await goto(page, routes.mutation_form)

	await page.fill('[data-testid="name-input"]', 'Enhanced Alice')
	await page.click('[data-testid="submit"]')

	await page.waitForURL(/\/mutation-form\/created\?id=/)
	await expect(page.getByTestId('created-id')).toContainText('MutationForm')
})

// The no-JS path: the same form submits natively, the server runs the mutation and 303s to
// the same target. This is the progressive-enhancement guarantee.
test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false })

	test('native POST runs the mutation and redirects', async ({ page }) => {
		await page.goto(routes.mutation_form)

		await page.fill('[data-testid="name-input"]', 'NoJS Bob')
		await page.click('[data-testid="submit"]') // a native form submit — no onSubmit

		await page.waitForURL(/\/mutation-form\/created\?id=/)
		await expect(page.getByTestId('created-id')).toContainText('MutationForm')
	})
})

// CSRF: a cross-origin native form POST is rejected fail-closed by the Origin check.
test('rejects a cross-origin form POST', async ({ request }) => {
	const res = await request.post(routes.mutation_form, {
		headers: {
			origin: 'http://evil.example',
			'content-type': 'application/x-www-form-urlencoded',
		},
		data: '__houdini_form=MutationFormCreate&name=Mallory&birthDate=946684800000',
		maxRedirects: 0,
	})
	expect(res.status()).toBe(403)
})
