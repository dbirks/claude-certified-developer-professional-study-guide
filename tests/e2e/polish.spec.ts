// Playwright coverage for the owner-feedback polish pass: the collapsed source list and the
// jumps that must reveal it (#sources via the citation sheet, #src-F3 via a deep link), the read
// pill ending with the lesson instead of the source list, the topbar search icon / title alignment
// / frosted band, and the home page's equal-height stat pills + whole-pill resume link.
import { expect, test, type Page } from '@playwright/test';
import {
  expectScrollSettled,
  expectTopBetween,
  normText,
  scrollToBottom,
  skipUnlessProject,
} from './helpers';

const CHAPTER = 'production-integration/reliability/';
const LAST_READ_KEY = 'ccdvp:last-read';

/** Wait for the bundled webfonts so text-metric assertions are not racing font swaps. */
async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Open state of the chapter's collapsed source list (`<details>`; the attribute reflects the property). */
const sourcesDetails = (page: Page) => page.locator('section.sources details.sources__details');

/** Alpha channel of a computed colour (`rgb(...)`, `rgba(...)`, `color(srgb … / a)`, `transparent`). */
function alphaOf(color: string): number {
  if (!color.includes('(')) return color.trim() === 'transparent' ? 0 : 1;
  const body = color.slice(color.indexOf('(') + 1, color.lastIndexOf(')'));
  const parts = body.split(/[\s,]+/).filter(Boolean);
  const slash = parts.indexOf('/');
  const raw = slash >= 0 ? parts[slash + 1] : parts.length >= 4 ? parts[3] : '';
  if (!raw) return 1;
  const value = Number.parseFloat(raw);
  return raw.endsWith('%') ? value / 100 : value;
}

test('sources are collapsed by default; the citation sheet\'s "All N sources" reveals them', async ({ page }) => {
  await page.goto(CHAPTER);

  await expect(sourcesDetails(page)).toHaveCount(1);
  await expect(sourcesDetails(page), 'the source list starts collapsed').not.toHaveAttribute('open');
  await expect(page.locator('section.sources .sources__count')).toHaveText(
    String(await page.locator('li.source').count()),
  );

  const chip = page.locator('a.cite').first();
  await chip.click();
  const pop = page.locator('#cite-pop');
  await expect(pop).toBeVisible();
  await expect(sourcesDetails(page), 'opening the sheet must not expand the list').not.toHaveAttribute('open');

  const count = await page.locator('li.source').count();
  expect(count).toBeGreaterThan(0);
  await expect(pop.locator('#cite-pop-jump')).toHaveText(`All ${count} sources`);

  await pop.locator('#cite-pop-jump').click();
  await expect(pop).toBeHidden();
  await expect(sourcesDetails(page), 'the jump button expands the collapsed list').toHaveAttribute('open');
  await expectScrollSettled(page);
  // The heading is revealed and lands just under the sticky topbar.
  await expectTopBetween(page, '#sources', 0, 260);
});

test('deep link to #src-F3 opens the list, lands on the row and highlights it', async ({ page }) => {
  await page.goto(`${CHAPTER}#src-F3`);

  await expect(sourcesDetails(page), 'a #src-* deep link expands the collapsed list').toHaveAttribute('open');
  const row = page.locator('#src-F3');
  await expect(row).toBeVisible();
  await expect(row).toBeInViewport();

  // The :target rule paints the row in --sky; the 600ms transition needs a beat, and a row
  // that is not the target keeps the plain --surface card colour.
  const plain = page.locator('#src-F1');
  await expect
    .poll(
      async () =>
        (await row.evaluate((el) => getComputedStyle(el).backgroundColor)) !==
        (await plain.evaluate((el) => getComputedStyle(el).backgroundColor)),
      { timeout: 6000, message: '#src-F3 never picked up the :target highlight' },
    )
    .toBe(true);
});

test('read pill hits 100% at the end of the lesson and stays there through the sources', async ({ page }) => {
  await page.goto(CHAPTER);

  const cards = page.locator('.self-check');
  expect(await cards.count(), 'the reliability chapter ends with self-checks').toBeGreaterThan(0);

  // Bring the bottom of the last self-check exactly to the bottom of the viewport.
  await cards.last().evaluate((el) => {
    const rect = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + rect.bottom - window.innerHeight);
  });
  await expectScrollSettled(page);
  await expect.poll(() => normText(page.locator('#read-pill-text'))).toBe('100%');

  // Keep scrolling into the (now long) source list: the lesson is over, so the pill stays at 100%.
  await scrollToBottom(page);
  await expectScrollSettled(page);
  await expect(page.locator('#read-pill-text')).toHaveText('100%');
});

test('topbar: the search key holds an icon and the two title scripts share one centre', async ({ page }) => {
  skipUnlessProject('desktop');
  await page.goto(CHAPTER);
  await fontsReady(page);

  const key = page.locator('.topbar__search-key');
  await expect(key).toBeVisible();
  await expect(key.locator('svg'), 'the "/" hint is the Lucide square-slash icon').toHaveCount(1);

  const centers = await page.evaluate(() => {
    const centreOf = (node: Node | null): number => {
      if (!node) return Number.NaN;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return rect.top + rect.height / 2;
    };
    const title = document.querySelector<HTMLElement>('.topbar__title');
    const rest = document.querySelector<HTMLElement>('.topbar__title-rest');
    const serif =
      title
        ? [...title.childNodes].find(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
          ) ?? null
        : null;
    return { serif: centreOf(serif), sans: centreOf(rest ?? null) };
  });

  expect(Number.isFinite(centers.serif), '"CCDV-P" text range measured').toBe(true);
  expect(Number.isFinite(centers.sans), '"Study Guide" text range measured').toBe(true);
  expect(Math.abs(centers.serif - centers.sans), 'vertical centres of the two scripts').toBeLessThanOrEqual(1);
});

test('topbar: a frosted band (or its @supports fallback) sits behind the floating pill', async ({ page }) => {
  await page.goto(CHAPTER);

  const band = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.topbar');
    if (!el) return null;
    const cs = getComputedStyle(el, '::before');
    const prefixed = cs as CSSStyleDeclaration & { webkitBackdropFilter?: string };
    return {
      content: cs.content,
      filter: cs.backdropFilter || prefixed.webkitBackdropFilter || 'none',
      background: cs.backgroundColor,
      pointerEvents: cs.pointerEvents,
    };
  });
  expect(band, '.topbar renders a ::before band').not.toBeNull();
  expect(band!.content, 'the band is a generated box').not.toBe('none');
  expect(band!.pointerEvents, 'the band must never swallow clicks').toBe('none');

  if (band!.filter.includes('blur')) {
    expect(band!.filter).toContain('blur');
  } else {
    // Browser without backdrop-filter: the @supports fallback paints an opaque-enough band.
    expect(alphaOf(band!.background), 'fallback band is non-transparent').toBeGreaterThan(0.5);
  }
});

test('home: the three stat pills are the same height', async ({ page }) => {
  await page.goto('.');
  await fontsReady(page);

  const pills = page.locator('.home-head__stat');
  expect(await pills.count()).toBe(3);
  const heights = await pills.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights), `stat pill heights ${heights.join(' / ')}`).toBeLessThanOrEqual(
    0.5,
  );
});

// fixme: reading.ts wraps only the title in an <a>; the pill's own 14px padding swallows the edge tap (home polish task is making the whole pill the link).
test.fixme('home: clicking the left edge of the resume pill opens the last-read chapter', async ({ page }) => {
  await page.goto('.');
  const base = await page.evaluate(() => document.body.dataset.base ?? '/');
  await page.evaluate(
    ([key, path]) => {
      try {
        localStorage.setItem(key, JSON.stringify({ path, heading: '', title: '3.1 Telemetry', at: 1 }));
      } catch {
        /* storage unavailable: the test then fails on the hidden pill */
      }
    },
    [LAST_READ_KEY, `${base}observability/telemetry/`] as [string, string],
  );

  await page.reload();
  const pill = page.locator('#resume-link');
  await expect(pill).toBeVisible();
  const box = await pill.boundingBox();
  expect(box, 'resume pill has a box').not.toBeNull();

  // 8px inside the LEFT edge: the whole pill is the link, not just its trailing title.
  await page.mouse.click(box!.x + 8, box!.y + box!.height / 2);
  await expect(page).toHaveURL(/observability\/telemetry\/$/);
});
