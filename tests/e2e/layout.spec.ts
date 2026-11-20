import { expect, test } from '@playwright/test';
import { skipUnlessProject } from './helpers';

const PAGES = ['.', 'production-integration/reliability/', 'reference/component-demo/'];

test('no horizontal overflow on home, a skill page, and the demo page', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(metrics.scrollWidth, `horizontal overflow on ${path}`).toBeLessThanOrEqual(
      metrics.innerWidth,
    );
  }

  if (test.info().project.name === 'mobile') {
    await page.goto('reference/component-demo/');
    const preScrolls = await page
      .locator('.prose pre')
      .first()
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(preScrolls, 'the first code block should scroll internally on mobile').toBe(true);
  }
});

test('subpath assets load cleanly and links stay under /ccdvp-test/', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (res) => {
    let url: URL;
    try {
      url = new URL(res.url());
    } catch {
      return;
    }
    if (url.origin === new URL(res.request().url()).origin && res.status() >= 400) {
      failed.push(`${res.status()} ${url.pathname}`);
    }
  });

  await page.goto('.');

  expect(failed, 'same-origin requests that failed').toEqual([]);

  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily).toContain('Inter');

  const rootLinks = await page.$$eval('a[href^="/"]', (links) =>
    links.map((a) => a.getAttribute('href') ?? ''),
  );
  expect(rootLinks.length).toBeGreaterThan(0);
  for (const href of rootLinks) {
    expect(href, 'root-relative link outside the deploy base').toMatch(/^\/ccdvp-test\//);
  }
});

test('theme toggle flips html[data-theme] and persists across reload', async ({ page }) => {
  skipUnlessProject('desktop');
  await page.goto('.');

  const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? '');
  const before = await theme();
  expect(['light', 'dark']).toContain(before);

  await page.click('#theme-toggle');
  const after = await theme();
  expect(after).not.toBe(before);
  expect(after).toBe(before === 'dark' ? 'light' : 'dark');

  await page.reload();
  await expect.poll(theme).toBe(after);
});
