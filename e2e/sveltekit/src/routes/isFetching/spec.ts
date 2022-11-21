import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  clientSideNavigation,
  goto,
  locator_click,
  waitForConsoleInfo
} from '../../lib/utils/testsHelper.js';

test.describe('isFetching', () => {
  test('with_load SSR', async ({ page }) => {
    const [msg] = await Promise.all([
      waitForConsoleInfo(page),
      goto(page, routes.isFetching_with_load)
    ]);

    expect(msg.text()).toBe('with_load - isFetching: false');
  });

  test('with_load CSR', async ({ page }) => {
    await goto(page, routes.Home);

    // Switch page and check directly the first console log
    const [msg] = await Promise.all([
      waitForConsoleInfo(page),
      clientSideNavigation(page, routes.isFetching_with_load)
    ]);
    expect(msg.text()).toBe('with_load - isFetching: true');

    // wait for the isFetching false
    const msg2 = await waitForConsoleInfo(page);
    expect(msg2.text()).toBe('with_load - isFetching: false');
  });

  test('without_load CSR', async ({ page }) => {
    await goto(page, routes.Home);

    // Switch page and check the first console log
    // It's expected to stay true until the first fetch!
    const [msg] = await Promise.all([
      waitForConsoleInfo(page),
      clientSideNavigation(page, routes.isFetching_without_load)
    ]);
    expect(msg.text()).toBe('without_load - isFetching: true');

    const [msg2] = await Promise.all([
      waitForConsoleInfo(page),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg2.text()).toBe('without_load - isFetching: true');

    // wait for the isFetching false
    const msg3 = await waitForConsoleInfo(page);
    expect(msg3.text()).toBe('without_load - isFetching: false');

    // second click should not refetch... so isFetching should be false
    const [msg4] = await Promise.all([
      waitForConsoleInfo(page),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg4.text()).toBe('without_load - isFetching: false');
  });

  test('loading the same store somewhere else', async ({ page }) => {
    await goto(page, routes.isFetching_route_1);

    // Switch page and check the first console log
    const [msg] = await Promise.all([
      page.waitForEvent('console', { predicate: (msg) => msg.type() === 'info' }),
      clientSideNavigation(page, './route_2')
    ]);

    // Here we load the same query with load_isFetching_route_1, but
    // 1/ we get the values from the cache directly!
    // 2/ we never go to isFetching! no more flickering.
    expect(msg.text()).toBe('isFetching_route_2 - isFetching: false');
  });
});
