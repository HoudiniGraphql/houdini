import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import addon from '../src/index.js';
import { setupTest } from './setup/suite.js';

// set to true to enable browser testing
const browser = false;

const { test, prepareServer, testCases } = setupTest(
  { addon },
  {
    kinds: [
      { type: 'remote', options: { [addon.id]: { who: 'you' } } }
      { type: 'local', options: { [addon.id]: { who: 'you' } } }
    ],
    filter: (testCase) => testCase.variant.includes('kit'),
    browser
  }
);

test.concurrent.for(testCases)(
  '@houdinigraphql/sv $kind.type $variant',
  async (testCase, { page, ...ctx }) => {
    const cwd = ctx.cwd(testCase);

    const msg = "Community Addon Template demo for the add-on: '@houdinigraphql/sv'!";

    const contentPath = path.resolve(cwd, `src/lib/@houdinigraphql/sv/content.txt`);
    const contentContent = fs.readFileSync(contentPath, 'utf8');
    // Check if we have the imports
    expect(contentContent).toContain(msg);

    const helloPath = path.resolve(cwd, `src/lib/@houdinigraphql/sv/HelloComponent.svelte`);
    const helloContent = fs.readFileSync(helloPath, 'utf8');
    // Check if we have the imports
    expect(helloContent).toContain('you');

    // For browser testing
    if (browser) {
      const { close } = await prepareServer({ cwd, page });
      // kill server process when we're done
      ctx.onTestFinished(async () => await close());

      // expectations
      const textContent = await page.locator('p').last().textContent();
      if (testCase.variant.includes('kit')) {
        expect(textContent).toContain(msg);
      } else {
        // it's not a kit plugin!
        expect(textContent).not.toContain(msg);
      }
    }
  }
);
