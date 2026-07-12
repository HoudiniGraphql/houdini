import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// A session change (updateSession, login, logout) invalidates every cached query result.
// Route queries refetch through the router's caches; this pins that useQuery's suspense
// state is invalidated the same way — without it a session-dependent useQuery keeps
// rendering data fetched under the old session.
test('useQuery refetches when the session changes', async ({ page }) => {
	await goto(page, routes.use_query_session)

	// no theme in the session yet
	await expect(page.locator('#theme')).toHaveText('(none)')

	// writing the session must invalidate the suspense state and refetch
	await page.click('#set-theme')
	await expect(page.locator('#theme')).toHaveText('updated-theme')
})

// The SSR fetch must run with the REQUEST's session: two requests carrying different
// session cookies get HTML rendered from their own session, for the same query and
// variables. (Raw request.get, so no hydration can mask what the server rendered.)
test('SSR renders each request with its own session', async ({ browser, request }) => {
	// establish two different sessions in two isolated browser contexts (updateSession
	// persists the signed session cookie through the auth endpoint) and capture the cookies
	const cookies: string[] = []
	for (const theme of ['theme-one', 'theme-two']) {
		const context = await browser.newContext()
		const page = await context.newPage()
		await goto(page, `${routes.use_query_session}?theme=${theme}`)

		const before = (await context.cookies()).find((c) => c.name === '__houdini__')?.value
		await page.click('#set-theme')
		// wait for the signed cookie to change (the persist is async)
		await expect
			.poll(async () => {
				return (await context.cookies()).find((c) => c.name === '__houdini__')?.value
			})
			.not.toBe(before)

		const value = (await context.cookies()).find((c) => c.name === '__houdini__')!.value
		cookies.push(`__houdini__=${value}`)
		await context.close()
	}

	// the same page, same query, same variables — each request must render its own session
	const first = await request.get(routes.use_query_session, {
		headers: { cookie: cookies[0] },
	})
	expect(await first.text()).toContain('theme-one')

	const second = await request.get(routes.use_query_session, {
		headers: { cookie: cookies[1] },
	})
	expect(await second.text()).toContain('theme-two')
})
