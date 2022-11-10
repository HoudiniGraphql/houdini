import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { clientSideNavigation, goto, locator_click } from '../../lib/utils/testsHelper.js';

test.describe('isFetching', () => {
  test('with_load SSR', async ({ page }) => {
    const [msg] = await Promise.all([
      page.waitForEvent('console'),
      goto(page, routes.isFetching_with_load)
    ]);

    expect(msg.text()).toBe('with_load - isFetching: false');
  });

  test('with_load CSR', async ({ page }) => {
    await goto(page, routes.Home);

    // Switch page and check directly the first console log
    const [msg] = await Promise.all([
      page.waitForEvent('console'),
      clientSideNavigation(page, routes.isFetching_with_load)
    ]);
    expect(msg.text()).toBe('with_load - isFetching: true');

    // wait for the isFetching false
    const msg2 = await page.waitForEvent('console');
    expect(msg2.text()).toBe('with_load - isFetching: false');
  });

  test('without_load CSR', async ({ page }) => {
    await goto(page, routes.Home);

    // Switch page and check the first console log
    // It's expected to stay true until the first fetch!
    const [msg] = await Promise.all([
      page.waitForEvent('console'),
      clientSideNavigation(page, routes.isFetching_without_load)
    ]);
    expect(msg.text()).toBe('without_load - isFetching: true');

    const [msg2] = await Promise.all([
      page.waitForEvent('console'),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg2.text()).toBe('without_load - isFetching: true');

    // wait for the isFetching false
    const msg3 = await page.waitForEvent('console');
    expect(msg3.text()).toBe('without_load - isFetching: false');

    // second click should not refetch... so isFetching should be false
    const [msg4] = await Promise.all([
      page.waitForEvent('console'),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg4.text()).toBe('without_load - isFetching: false');
  });
});
