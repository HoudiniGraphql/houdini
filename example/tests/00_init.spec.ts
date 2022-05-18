import { test, expect } from '@playwright/test'

test('basic test', async ({ page }) => {
	await page.goto('http://localhost:3000/about')

	// page.on('request', (request) => console.log('>>', request.method(), request.url()))
	// page.on('response', (response) => console.log('<<', response.status(), response.url()))

	const h2 = page.locator('h2')
	console.log(`h2`, h2)
	await expect(h2).toHaveText('Playwright')
})
