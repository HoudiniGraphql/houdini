import { test } from '@playwright/test'
import { expect_to_be, goto } from '~/utils/testsHelper'

// A custom-scalar route param round-trips: the path segment holds the marshaled DateTime
// (getTime() ms), useRoute().location.params.day reads back a Date, and the query still
// runs (the rich value re-marshals through marshalInputs without crashing). Loaded
// directly (server render), so it also covers the SSR path for route params.
// new Date('2024-01-01T00:00:00.000Z').getTime() === 1704067200000
test('custom-scalar route param unmarshals and round-trips on direct load', async ({ page }) => {
	await goto(page, '/route_params_date/1704067200000')

	await expect_to_be(page, 'Date', '#day-type')
	await expect_to_be(page, '2024-01-01T00:00:00.000Z', '#day-iso')
	await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')
})
