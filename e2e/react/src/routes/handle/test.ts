import { expect, test } from '@playwright/test'
import { dataUsers } from 'e2e-api/graphql.mjs'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('handle fetch remembers server-side variables', async function ({ page }) {
	// in this test, variables are stringified in the #variables div
	const getVariables = async () => {
		return JSON.parse((await page.textContent('#variables')) as string)
	}

	// visit the page for user 2
	await goto(page, routes.handle_2)
	await expect(page.textContent('#result')).resolves.toEqual(dataUsers[1].avatarURL)

	// check the variables
	await expect(getVariables()).resolves.toEqual({ userID: '2' })

	// load the larger image and wait for it to resolve
	await page.click('#larger')
	await page.waitForSelector('[data-size="51"]', {
		timeout: 1000,
	})

	// make sure the and variables line up
	await expect(page.textContent('#result')).resolves.toContain(dataUsers[1].avatarURL)
	await expect(getVariables()).resolves.toEqual({ userID: '2', size: 51 })

	// now load user 1
	await page.click('#user-1')
	await page.waitForSelector('[data-user="1"]', {
		timeout: 1000,
	})

	// make sure the and variables line up
	await expect(page.textContent('#result')).resolves.toContain(dataUsers[0].avatarURL)
	await expect(getVariables()).resolves.toEqual({ userID: '1', size: 51 })
})
