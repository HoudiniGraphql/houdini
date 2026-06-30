import { expect, test } from '@playwright/test'
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

test('useRoute().search exposes the parsed query string', async ({ page }) => {
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

// the unmarshal happens in the Router body, which runs during SSR too — so a cold load
// (server render) with a custom-scalar search param in the url must produce the same Date
test('search params unmarshal on a direct (SSR) load', async ({ page }) => {
	await goto(page, '/search_params?after=1704067200000')

	await expect_to_be(page, 'Date', '#after-type')
	await expect_to_be(page, '2024-01-01T00:00:00.000Z', '#after-iso')
	// the query ran on the server with the marshaled variable, without crashing
	await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')
})

// a custom scalar (DateTime) marshals into the url on write, is sent to the API in that
// same marshaled form, and unmarshals back to a Date when read via useRoute().search —
// verified through both <Link> and goto. The marshaled form is getTime() ms:
// new Date('2024-01-01T00:00:00.000Z').getTime() === 1704067200000
test('custom-scalar search params round-trip through Link and goto', async ({ page }) => {
	// captures the `after` variable as it was actually sent on the wire while `trigger`
	// performs a navigation
	async function sentAfter(trigger: () => Promise<unknown>): Promise<unknown> {
		const [request] = await Promise.all([
			page.waitForRequest(
				(req) =>
					req.url().includes('/_api') &&
					req.method() === 'POST' &&
					(req.postData() ?? '').includes('SearchParamsUsers')
			),
			trigger(),
		])
		return request.postDataJSON()?.variables?.after
	}

	// ── <Link search={{ after: Date }}> ─────────────────────────────────────────────
	await goto(page, routes.search_params)
	const linkAfter = await sentAfter(() => page.click('#date-link'))
	await sleep(100)

	// 1. the Date was marshaled into the query string
	expect(page.url()).toContain('?after=1704067200000')
	// 2. and sent to the API in its marshaled form (the number, not the raw url string)
	expect(linkAfter).toBe(1704067200000)
	// 3. and unmarshaled back to a real Date when read
	await expect_to_be(page, 'Date', '#after-type')
	await expect_to_be(page, '2024-01-01T00:00:00.000Z', '#after-iso')

	// ── goto({ to, search: { after: Date } }) ───────────────────────────────────────
	await goto(page, routes.search_params)
	const gotoAfter = await sentAfter(() => page.click('#goto-date'))
	await sleep(100)

	expect(page.url()).toContain('?after=1704067200000')
	expect(gotoAfter).toBe(1704067200000)
	await expect_to_be(page, 'Date', '#after-type')
	await expect_to_be(page, '2024-01-01T00:00:00.000Z', '#after-iso')
})
