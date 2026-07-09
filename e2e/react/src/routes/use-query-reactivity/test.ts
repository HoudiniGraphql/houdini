import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// A useQuery component and mutations live in sibling components. One ordered flow (so the
// steps don't fight over the shared api snapshot) pinning two reactivity contracts:
//
// 1. After the initial load (which suspended once), a sibling mutation's cache write must
//    re-render the query component. This pins the observer-reuse behavior in
//    useQueryHandle: suspending discards the component instance that started the fetch,
//    so the retry render has to pick the original store back up — the cache subscription
//    belongs to it, and a fresh store would never hear about the write.
//
// 2. After a variables change (which re-suspends the already-committed instance), a
//    sibling mutation's cache write must still re-render it. This pins the suspenseTracker
//    reset: re-suspending flips the mute flag on the committed instance's ref, and without
//    resetting it after the render commits, the subscription stays muted forever.
test('useQuery reflects sibling mutation cache writes after load and after re-suspension', async ({
	page,
}) => {
	// the query resolved during SSR; hydration serves it from the streamed cache snapshot
	await goto(page, routes.use_query_reactivity)

	await expect(page.locator('#name')).toHaveText('Bruce Willis')

	// a mutation on the rendered record propagates to the queried sibling
	await page.click('#update-1')
	await expect(page.locator('#name')).toHaveText('Updated One')

	// switching the id prop re-suspends the query component with new variables
	await page.click('#switch')
	await expect(page.locator('#name')).toHaveText('Samuel Jackson')

	// and after that re-suspension, cache writes must still propagate
	await page.click('#update-2')
	await expect(page.locator('#name')).toHaveText('Updated Two')
})
