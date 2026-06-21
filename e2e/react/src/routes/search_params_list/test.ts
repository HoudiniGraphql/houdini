import { test, expect } from '@playwright/test'
import { sleep } from '~/utils/sleep'
import { expect_to_be, goto } from '~/utils/testsHelper'

// List search params serialize as repeated keys and read back as arrays — including the
// single-value case (which must stay a one-element array, not collapse to a bare value) —
// and a custom-scalar List unmarshals element-wise.
test('List search params round-trip as arrays (incl. single element and custom scalars)', async ({
	page,
}) => {
	await goto(page, '/search_params_list')

	// a multi-value List -> repeated query keys -> array
	await page.click('#tags-multi')
	await sleep(100)
	expect(page.url()).toContain('?tags=a&tags=b')
	await expect_to_be(page, '["a","b"]', '#tags')

	// a single value for a List param stays a one-element array, not a bare "solo"
	await page.click('#tags-single')
	await sleep(100)
	expect(page.url()).toContain('?tags=solo')
	await expect_to_be(page, '["solo"]', '#tags')

	// a custom-scalar (DateTime) List unmarshals each element back to a Date
	await page.click('#dates-link')
	await sleep(100)
	await expect_to_be(page, 'Date,Date', '#dates-types')
	await expect_to_be(page, '2024-01-01T00:00:00.000Z,2024-06-01T00:00:00.000Z', '#dates-isos')
})
