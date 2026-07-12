import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// A page query can take its variables from the session through a runtime scalar
// ($snapshot: UsersSnapshotFromSession). Updating the session is a data event, not a
// navigation: every active query whose inputs came from the session must refetch with the
// new value. This mirrors an app that keeps the current organization id in the session —
// switching organizations must reload the page's data for the new organization.
test('a session update refetches active queries with the new runtime scalar value', async ({
	page,
}) => {
	await goto(page, routes.session_query_refetch)

	// the initial render resolved the runtime scalar against the (empty) session
	await expect(page.getByTestId('users')).toContainText('session-query-refetch-initial:1')

	// update the session — the active query must refire with the new snapshot
	await page.click('[data-testid="switch-snapshot"]')
	await expect(page.getByTestId('users')).toContainText('session-query-refetch-next:1')
})

// The same session write, but sharing a transition with a navigation — the org-switcher
// pattern (setSession({ organization }) then goto('/')). The navigation's urgent pending-url
// update renders before the new session state commits, so the invalidated caches get
// repopulated under the OLD session; the new-session render then finds every document
// "cached" and skips the refetch. The data on screen must still converge to the new
// session's value.
test('a session update alongside a navigation still refetches with the new value', async ({
	page,
}) => {
	await goto(page, routes.session_query_refetch)
	await expect(page.getByTestId('users')).toContainText('session-query-refetch-initial:1')

	// update the session and navigate in the same transition
	await page.click('[data-testid="switch-snapshot-goto"]')
	await expect(page.getByTestId('users')).toContainText('session-query-refetch-goto:1')
})
