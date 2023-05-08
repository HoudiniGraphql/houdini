import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  clientSideNavigation,
  goto,
  locator_click,
  waitForConsole
} from '../../lib/utils/testsHelper.js';

test.describe('fetching', () => {
  test('with_load SSR', async ({ page }) => {
    const [msg] = await Promise.all([waitForConsole(page), goto(page, routes.fetching_with_load)]);

    expect(msg.text()).toBe('with_load - fetching: false');
  });

  test('with_load CSR', async ({ page }) => {
    await goto(page, routes.Home);

    // Switch page and check directly the first console log
    const [msg] = await Promise.all([
      waitForConsole(page),
      clientSideNavigation(page, routes.fetching_with_load)
    ]);
    expect(msg.text()).toBe('with_load - fetching: true');

    // wait for the fetching false
    const msg2 = await waitForConsole(page);
    expect(msg2.text()).toBe('with_load - fetching: false');
  });

  test('without_load CSR', async ({ page }) => {
    await goto(page, routes.Home);

    // Switch page and check the first console log
    const [msg] = await Promise.all([
      waitForConsole(page),
      clientSideNavigation(page, routes.fetching_without_load)
    ]);
    expect(msg.text()).toBe('without_load - fetching: false');

    const [msg2] = await Promise.all([
      waitForConsole(page),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg2.text()).toBe('without_load - fetching: true');

    // wait for the fetching false
    const msg3 = await waitForConsole(page);
    expect(msg3.text()).toBe('without_load - fetching: false');

    // second click should not refetch... so fetching should be false
    const [msg4] = await Promise.all([
      waitForConsole(page),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg4.text()).toBe('without_load - fetching: false');
  });

  test('without_load_external_file CSR', async ({ page }) => {
    await goto(page, routes.Home);

    // Switch page and check the first console log
    const [msg] = await Promise.all([
      waitForConsole(page),
      clientSideNavigation(page, routes.fetching_without_load_external_file)
    ]);
    expect(msg.text()).toBe('without_load_external_fileStore - fetching: false');

    const [msg2] = await Promise.all([
      waitForConsole(page),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg2.text()).toBe('without_load_external_fileStore - fetching: true');

    // wait for the fetching false
    const msg3 = await waitForConsole(page);
    expect(msg3.text()).toBe('without_load_external_fileStore - fetching: false');

    // second click should not refetch... so fetching should be false
    const [msg4] = await Promise.all([
      waitForConsole(page),
      // manual fetch
      locator_click(page, 'button')
    ]);
    expect(msg4.text()).toBe('without_load_external_fileStore - fetching: false');
  });

  test('loading the same store somewhere else', async ({ page }) => {
    await goto(page, routes.fetching_route_1);

    // Switch page and check the first console log
    const [msg] = await Promise.all([
      waitForConsole(page),
      clientSideNavigation(page, './route_2')
    ]);

    // Here we load the same query with load_fetching_route_1, but
    // 1/ we get the values from the cache directly!
    // 2/ we never go to fetching! no more flickering.
    expect(msg.text()).toBe('fetching_route_2 - fetching: false');
  });
});
