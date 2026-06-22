import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// useMutationFormStatus: a child of <Form> sees the pending state via context while the
// (delayed) mutation runs, then the form navigates on success.
test('a child reads pending via useMutationFormStatus, then the form redirects', async ({
	page,
}) => {
	await goto(page, routes.mutation_form_status)

	await page.fill('[data-testid="name-input"]', 'Status Sam')
	await page.click('[data-testid="submit"]')

	// the Submit child (which only knows pending via the context) reflects it
	await expect(page.getByTestId('submit')).toHaveText('Saving…')

	await page.waitForURL(/\/mutation-form\/created\?id=/)
	await expect(page.getByTestId('created-id')).toContainText('MutationFormStatus')
})
