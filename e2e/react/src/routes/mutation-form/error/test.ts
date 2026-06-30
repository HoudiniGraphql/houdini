import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The enhanced (client) error path: after hydration onSubmit runs the mutation, the resolver
// forces a GraphQL error, and the form must surface state.errors, fire onError, and stay put —
// the @endpoint redirect is suppressed because the result carries errors.
test('enhanced submit surfaces the error, fires onError, and does not redirect', async ({
	page,
}) => {
	await goto(page, routes.mutation_form_error)

	await page.fill('[data-testid="name-input"]', 'Errored Eve')
	await page.click('[data-testid="submit"]')

	// the error renders from state.errors with the resolver's message
	await expect(page.getByTestId('error')).toHaveText('force ERROR!')
	// the onError callback fired on the enhanced path
	await expect(page.getByTestId('on-error')).toBeVisible()
	// and we stayed on the form — the redirect is suppressed when errors are present
	await expect(page).toHaveURL(new RegExp(`${routes.mutation_form_error}$`))
})
