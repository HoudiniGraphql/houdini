import { test } from '@playwright/test'
import { expect_to_be, goto } from '~/utils/testsHelper'

// a layout with its own query exposes that query's nullable variable as a LayoutRoute search
// param, read via useRoute<LayoutRoute>() inside the layout component. Loaded directly, so it
// also covers a layout reading search on the server-rendered initial load.
test('layout reads its search param via useRoute<LayoutRoute>()', async ({ page }) => {
	await goto(page, '/layout_search?limit=3')
	await expect_to_be(page, '3', '#layout-limit')
})
