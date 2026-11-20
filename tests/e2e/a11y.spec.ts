// Accessibility audit (axe-core) over key pages × theme × interactive state.
// Infrastructure only: it measures and records, it never patches app code.
// Full violation data is appended to .ccdvp-a11y/axe-results.jsonl for docs/a11y-report.md.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { appendFileSync, mkdirSync } from 'node:fs';
import { openDrawer, skipUnlessProject } from './helpers';

// Optional: audit a private build snapshot instead of the shared :4391 e2e server, so a
// freshly built dist can be measured without disturbing the other suites' webServer.
//   CCDVP_A11Y_BASE_URL=http://localhost:<port>/ccdvp-test/ pnpm exec playwright test tests/e2e/a11y.spec.ts
if (process.env.CCDVP_A11Y_BASE_URL) test.use({ baseURL: process.env.CCDVP_A11Y_BASE_URL });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const RESULTS_DIR = '.ccdvp-a11y';
const RESULTS_FILE = `${RESULTS_DIR}/axe-results.jsonl`;
// Optional tag for this run, so records from parallel/repeated runs can be told apart:
//   CCDVP_A11Y_RUN=2026-11-19-a pnpm exec playwright test tests/e2e/a11y.spec.ts
const RUN = process.env.CCDVP_A11Y_RUN ?? '';

/**
 * Rules with known critical/serious violations, pending app-code fixes — every one of these is
 * listed at the top of docs/a11y-report.md with the file to change. Remove an entry once the fix
 * lands; the assertion then blocks on it again.
 */
// Both previously known rules (color-contrast on Shiki comments, scrollable-region-focusable on
// .figure__body) were fixed on 2026-11-19; keep this empty so any regression fails the suite.
const KNOWN_SERIOUS_RULES: Record<string, string> = {};

type Theme = 'light' | 'dark';

const PAGES: { name: string; path: string; cites: boolean }[] = [
  { name: 'home', path: '', cites: false },
  { name: 'production-integration/reliability', path: 'production-integration/reliability/', cites: true },
  { name: 'agent-architecture/durable-execution', path: 'agent-architecture/durable-execution/', cites: true },
  { name: 'reference/api-reference', path: 'reference/api-reference/', cites: true },
];

const THEMES: Theme[] = ['light', 'dark'];

/** Set the stored theme before the inline head script runs, so html[data-theme] is applied pre-paint. */
async function gotoWithTheme(page: Page, path: string, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('ccdvp:theme', value);
    } catch {
      /* private mode: inline script falls back to the system theme */
    }
  }, theme);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.waitForFunction(() => document.fonts.status === 'loaded').catch(() => undefined);
}

async function openCitationSheet(page: Page): Promise<boolean> {
  const cite = page.locator('a.cite').first();
  if ((await cite.count()) === 0) return false;
  await cite.click();
  await expect(page.locator('#cite-pop')).toBeVisible();
  return true;
}

/** "<describe> · <theme>" is the parent title part; "page · <state>" is the test title. */
function labels(testInfo: TestInfo): { page: string; theme: string; state: string } {
  const parent = testInfo.titlePath[testInfo.titlePath.length - 2] ?? '';
  const [page, theme] = parent.split(' · ');
  const state = testInfo.title.split(' · ')[1] ?? testInfo.title;
  return { page: page ?? parent, theme: theme ?? '', state };
}

function record(testInfo: TestInfo, violations: readonly any[]): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const { page, theme, state } = labels(testInfo);
  const lines = violations.map((v: any) =>
    JSON.stringify({
      run: RUN,
      project: testInfo.project.name,
      page,
      theme,
      state,
      id: v.id,
      impact: v.impact,
      help: v.help,
      description: v.description,
      url: v.helpUrl,
      nodes: v.nodes.length,
      examples: v.nodes.slice(0, 3).map((n: any) => ({
        target: n.target,
        html: String(n.html ?? '').slice(0, 240),
        failureSummary: n.failureSummary,
        checks: [...(n.any ?? []), ...(n.all ?? []), ...(n.none ?? [])].map((c: any) => ({
          id: c.id,
          message: c.message,
          data: c.data,
        })),
      })),
    }),
  );
  if (lines.length) appendFileSync(RESULTS_FILE, `${lines.join('\n')}\n`);
}

async function scan(testInfo: TestInfo, page: Page): Promise<any[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  record(testInfo, results.violations);
  return results.violations;
}

function summarize(violations: readonly any[]): string {
  return violations
    .map((v: any) => `${v.id} (${v.impact}) ×${v.nodes.length} → ${JSON.stringify(v.nodes[0]?.target ?? [])}`)
    .join(' | ');
}

/**
 * Blocking assertion. Rules listed in KNOWN_SERIOUS_RULES (tracked in docs/a11y-report.md) are
 * reported as fixme so the suite stays green; anything else still fails the test, so a regression
 * or a new violation is caught even on pages that already have known problems.
 */
function assertNoSerious(violations: readonly any[], testInfo: TestInfo): void {
  const blocking = violations.filter((v: any) => v.impact === 'critical' || v.impact === 'serious');
  const known = blocking.filter((v: any) => v.id in KNOWN_SERIOUS_RULES);
  const unexpected = blocking.filter((v: any) => !(v.id in KNOWN_SERIOUS_RULES));

  expect(unexpected, `critical/serious violations: ${summarize(unexpected)}`).toHaveLength(0);

  if (known.length) {
    for (const v of known) {
      testInfo.annotations.push({
        type: 'fixme',
        description: `${v.id} (${v.impact} ×${v.nodes.length}): ${v.help} — ${KNOWN_SERIOUS_RULES[v.id]}`,
      });
    }
    test.fixme(true, `known violations: ${known.map((v: any) => `${v.id} ×${v.nodes.length}`).join(', ')}`);
  }
}

for (const spec of PAGES) {
  for (const theme of THEMES) {
    test.describe(`${spec.name} · ${theme}`, () => {
      test.setTimeout(90_000);

      test('page · default', async ({ page }, testInfo) => {
        await gotoWithTheme(page, spec.path, theme);
        assertNoSerious(await scan(testInfo, page), testInfo);
      });

      // Drawer only exists below 1024px: on desktop the sidebar is permanent (and #toc-toggle is
      // display:none), which the 'default' scan already covers.
      test('page · drawer open', async ({ page }, testInfo) => {
        skipUnlessProject('mobile');
        await gotoWithTheme(page, spec.path, theme);
        await openDrawer(page);
        assertNoSerious(await scan(testInfo, page), testInfo);
      });

      if (spec.cites) {
        test('page · citation sheet', async ({ page }, testInfo) => {
          await gotoWithTheme(page, spec.path, theme);
          test.skip(!(await openCitationSheet(page)), 'no citations on this page');
          assertNoSerious(await scan(testInfo, page), testInfo);
        });
      }
    });
  }
}
