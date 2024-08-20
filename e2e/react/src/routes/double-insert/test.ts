import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('Double Insert', async ({ page }) => {
	await goto(page, routes.double_insert)
    
    // click on the mutation
    await page.click("#insert")
    // wait a bit for the mutation to resolve
    await page.waitForTimeout(500)

    // look up the result
    const result = JSON.parse(await page.textContent('#result') || '{"list1": [], "list2": []}')

    // make sure there are the same number of entries in both lists
    expect(result.list1.length).toEqual(5)
    expect(result.list1.length).toEqual(result.list2.length)
})
