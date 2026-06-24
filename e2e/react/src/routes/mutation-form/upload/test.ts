import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The enhanced (client) upload path: the File from the input rides through coerceFormData
// and the normal client multipart pipeline to the resolver, which echoes its contents back.
test('uploads a file through the enhanced form path', async ({ page }) => {
	await goto(page, routes.mutation_form_upload)

	await page.setInputFiles('[data-testid="file-input"]', {
		name: 'note.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('hello from a form upload'),
	})
	await page.click('[data-testid="submit"]')

	await expect(page.getByTestId('result')).toHaveText('hello from a form upload')
})
