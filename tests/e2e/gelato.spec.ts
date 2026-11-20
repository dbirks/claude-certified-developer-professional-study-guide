// Playwright coverage for the "Gelato" visual system (docs/ARCHITECTURE.md §Gelato visual system):
// topbar read pill + search field label, the drawer theme switch vs. the topbar theme toggle,
// the citation sheet, always-visible self-check answers, the numbered pager and the Gelato fonts.
import { expect, test, type Page } from '@playwright/test';
import {
  expectScrollSettled,
  expectTopBetween,
  normText,
  normalizeSpace,
  openDrawer,
  scrollToBottom,
  skipUnlessProject,
} from './helpers';

const CHAPTER = 'production-integration/reliability/';
const DEMO = 'reference/component-demo/';

/** Mirrors MATCH_LABEL in src/scripts/cite.ts. */
const MATCH_LABEL: Record<string, string> = {
  ok: 'Quote matches page',
  'ok-loose': 'Quote closely matches',
};

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? '');

test('drawer theme switch sets the theme, marks aria-pressed and survives a reload', async ({ page }) => {
  skipUnlessProject('mobile');
  await page.goto('.');

  await openDrawer(page);
  await page.locator('.theme-switch [data-theme-set="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-switch [data-theme-set="dark"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.theme-switch [data-theme-set="light"]')).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await expect.poll(() => theme(page)).toBe('dark');
  await openDrawer(page);
  await expect(page.locator('.theme-switch [data-theme-set="dark"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('.theme-switch [data-theme-set="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.theme-switch [data-theme-set="light"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ccdvp:theme'))).toBe('light');
});

test('desktop: #theme-toggle sits in the topbar and flips the theme', async ({ page }) => {
  skipUnlessProject('desktop');
  await page.goto(CHAPTER);

  const toggle = page.locator('#theme-toggle');
  await expect(toggle).toBeVisible();

  const before = await theme(page);
  expect(['light', 'dark']).toContain(before);

  await toggle.click();
  const flipped = before === 'dark' ? 'light' : 'dark';
  await expect.poll(() => theme(page)).toBe(flipped);
  await page.reload();
  await expect.poll(() => theme(page)).toBe(flipped);

  await toggle.click();
  await expect.poll(() => theme(page)).toBe(before);
});

test('mobile: the topbar has no theme toggle; the drawer owns the theme switch', async ({ page }) => {
  skipUnlessProject('mobile');
  await page.goto(CHAPTER);

  await expect(page.locator('#theme-toggle')).toBeHidden();
  await expect(page.locator('.theme-switch')).toBeHidden(); // closed drawer

  await openDrawer(page);
  await expect(page.locator('.theme-switch')).toBeVisible();
  await expect(page.locator('.theme-switch [data-theme-set="light"]')).toBeVisible();
  await expect(page.locator('.theme-switch [data-theme-set="dark"]')).toBeVisible();
});

test('read pill shows 0% at the top of a chapter and 100% at the bottom', async ({ page }) => {
  await page.goto(CHAPTER);

  const pill = page.locator('#read-pill');
  await expect(pill, 'the pill is revealed on chapter pages by reading.ts').toBeVisible();
  await expect(page.locator('#read-pill-text')).toHaveText('0%');

  await scrollToBottom(page);
  await expectScrollSettled(page);
  await expect
    .poll(() => normText(page.locator('#read-pill-text')), { message: 'pill never reached the end' })
    .toMatch(/^(99|100)%$/);

  // The bar in the pill tracks the same percentage.
  const fillWidth = await page.locator('#read-pill-fill').evaluate((el) => el.style.width);
  expect(parseFloat(fillWidth)).toBeGreaterThanOrEqual(99);
});

test('read pill stays hidden on the home page', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#read-pill')).toBeHidden();
  await expect(page.locator('#read-pill-text')).toHaveText('0%'); // still rendered, just not shown
});

test('desktop: the search field label is visible and opens the dialog', async ({ page }) => {
  skipUnlessProject('desktop');
  await page.goto('.');

  await expect(page.locator('.topbar__search-text')).toBeVisible();
  await expect(page.locator('.topbar__search-text')).toHaveText('Search the guide');
  await page.locator('#search-open').click();
  await expect(page.locator('#search-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-dialog')).toBeHidden();
});

test('mobile: the search field label is hidden but the button still opens the dialog', async ({ page }) => {
  skipUnlessProject('mobile');
  await page.goto('.');

  await expect(page.locator('.topbar__search-text')).toBeHidden();
  await expect(page.locator('.topbar__search-key')).toBeHidden();

  const box = await page.locator('#search-open').boundingBox();
  expect(box, '#search-open tappable').not.toBeNull();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.locator('#search-dialog')).toBeVisible();
});

test('citation sheet copies the source row and jumps to the source list', async ({ page }) => {
  await page.goto(CHAPTER);

  const cite = page.locator('a.cite').first();
  const id = await cite.getAttribute('data-cite');
  expect(id, 'first citation carries a data-cite').toBeTruthy();
  const row = page.locator(`#src-${id}`);
  await expect(row).toHaveCount(1);

  await cite.click();
  const pop = page.locator('#cite-pop');
  await expect(pop).toBeVisible();

  const match = normalizeSpace(await row.getAttribute('data-match'));
  if (match) {
    await expect(pop.locator('#cite-pop-match')).toBeVisible();
    await expect(pop.locator('#cite-pop-match-text')).toHaveText(MATCH_LABEL[match] ?? '');
  } else {
    await expect(pop.locator('#cite-pop-match')).toBeHidden();
  }

  await expect
    .poll(async () => (await normText(pop.locator('#cite-pop-quote'))) === (await normText(row.locator('.source__quote'))))
    .toBe(true);

  const sources = await page.locator('li.source').count();
  expect(sources).toBeGreaterThan(0);
  await expect(page.locator('#cite-pop-jump')).toHaveText(`All ${sources} sources`);

  await page.locator('#cite-pop-jump').click();
  await expect(pop).toBeHidden();
  await expectScrollSettled(page);
  // The heading lands just below the sticky topbar (its scroll-margin) and stays in view.
  await expectTopBetween(page, '#sources', 0, 260);
});

test('self-check answers are visible without interaction on teaching chapters', async ({ page }) => {
  await page.goto(CHAPTER);

  const card = page.locator('.self-check').first();
  await expect(card).toHaveCount(1);
  await expect(card.locator('.self-check__a')).toBeVisible();
  expect(normalizeSpace(await card.locator('.self-check__body').textContent()).length).toBeGreaterThan(0);
});

test('pager links carry the neighbouring skill numbers and short titles', async ({ page }) => {
  await page.goto(CHAPTER);

  const next = page.locator('.pager__link--next');
  await expect(next).toContainText('2.2');
  await expect(next).toContainText('Scale and Throughput');

  const prev = page.locator('.pager__link--prev');
  await expect(prev).toContainText('1.4');

  expect(await next.getAttribute('href')).toContain('/production-integration/scale-throughput/');
});

const computedFont = (page: Page, selector: string): Promise<{ family: string; weight: string }> =>
  page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, weight: cs.fontWeight };
  });

test('Gelato fonts: Young Serif headings and DM Mono inline code', async ({ page }) => {
  await page.goto(CHAPTER);

  const h1 = await computedFont(page, 'h1');
  expect(h1.family).toContain('Young Serif');
  expect(h1.weight).toBe('400');

  const code = await computedFont(page, '.prose :not(pre) > code');
  expect(code.family).toContain('DM Mono');
});

test('component demo page: same fonts and answers shown without a disclosure', async ({ page }) => {
  await page.goto(DEMO);

  const h1 = await computedFont(page, 'h1');
  expect(h1.family).toContain('Young Serif');
  expect(h1.weight).toBe('400');

  const cards = page.locator('.self-check');
  expect(await cards.count(), 'the demo page renders self-check cards').toBeGreaterThan(0);
  for (const card of await cards.all()) {
    await expect(card.locator('.self-check__a')).toBeVisible();
    expect(normalizeSpace(await card.locator('.self-check__body').textContent()).length).toBeGreaterThan(0);
  }
});
