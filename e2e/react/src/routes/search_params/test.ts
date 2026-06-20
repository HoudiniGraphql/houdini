import { test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { sleep } from '~/utils/sleep'
import { expect_to_be, goto } from '~/utils/testsHelper'

test('Search params drive query variables', async ({ page }) => {
	await goto(page, routes.search_params)

	// with no search params the query uses the schema default limit of 4
	await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')

	// an offset search param shifts the window
	await page.click('#offset-link')
	await sleep(100)
	await expect_to_be(page, 'Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford')

	// a limit search param (without offset) shrinks the window from the start
	await page.click('#limit-link')
	await sleep(100)
	await expect_to_be(page, 'Bruce Willis, Samuel Jackson')

	// navigating back to the bare route clears the search params
	await page.click('#default-link')
	await sleep(100)
	await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')
})

test('useLocation().search exposes the parsed query string', async ({ page }) => {
	await goto(page, routes.search_params)

	// no query string -> empty object
	await expect_to_be(page, '{}', '#search')

	// a declared param is coerced to its scalar type (number, not "2")
	await page.click('#offset-link')
	await sleep(100)
	await expect_to_be(page, '{"offset":2}', '#search')
	await expect_to_be(page, 'number', '#offset-type')

	// a UI-only key (not a query variable) passes through as a raw string alongside
	// the coerced declared param
	await page.click('#ui-link')
	await sleep(100)
	await expect_to_be(page, '{"offset":2,"tab":"reviews"}', '#search')
})
