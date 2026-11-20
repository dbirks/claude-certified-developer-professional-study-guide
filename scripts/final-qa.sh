#!/usr/bin/env bash
# Consolidated, memory-friendly QA pass: ONE browser at a time, everything serial.
#   bash scripts/final-qa.sh            → report in .ccdvp-qa/report.md, screenshots in .ccdvp-qa/shots/
# Checklist:
#  1. astro check (types)                         6. alignment checker on every page, 390+1440, light+dark
#  2. citations: check-citations + yaml parse     7. horizontal-overflow sweep on every page, 390/768/1440, light+dark
#  3. production build (subpath) + pagefind       8. full Playwright suite (--workers=1): e2e + a11y + gelato + polish
#  4. internal links + fragments                  9. screenshots of key pages/states for human review
#  5. research index regenerated (coverage, sources, fact-check log)
set -u
cd "$(dirname "$0")/.."
OUT=.ccdvp-qa; rm -rf $OUT; mkdir -p $OUT/shots
R=$OUT/report.md; : > $R
step() { echo; echo "## $1" | tee -a $R; }
res() { echo "- $1" | tee -a $R; }

step "1. Type check"
pnpm astro check > $OUT/check.log 2>&1 && res "astro check: OK" || res "astro check: FAIL (see check.log): $(grep -m3 error $OUT/check.log | tr '\n' ' ')"

step "2. Citations"
node scripts/check-citations.mjs > $OUT/cit.log 2>&1 && res "check-citations: OK" || res "check-citations: FAIL — $(tail -3 $OUT/cit.log | tr '\n' ' ')"

step "3. Build (BASE_PATH=/claude-certified-developer-professional-study-guide/)"
export BASE_PATH=/claude-certified-developer-professional-study-guide/
if pnpm astro build --outDir $OUT/dist > $OUT/build.log 2>&1 && pnpm exec pagefind --site $OUT/dist >> $OUT/build.log 2>&1; then
  res "build + pagefind: OK ($(grep -o '[0-9]* page(s) built' $OUT/build.log | tail -1))"
else res "build: FAIL — $(tail -5 $OUT/build.log | tr '\n' ' ')"; fi

step "4. Links"
node scripts/check-links.mjs $OUT/dist > $OUT/links.log 2>&1; res "$(tail -1 $OUT/links.log)"

step "5. Research index"
node scripts/build-research-index.mjs 2>&1 | tail -2 | while read -r l; do res "$l"; done

# Serve the build at the subpath for browser steps (dist/<base> layout).
mkdir -p $OUT/site && ln -sfn "$(pwd)/$OUT/dist" "$OUT/site/claude-certified-developer-professional-study-guide"
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("",0));print(s.getsockname()[1])')
python3 -m http.server $PORT --directory $OUT/site > /dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
BASEURL="http://localhost:$PORT${BASE_PATH}"

step "6. Vertical alignment (glyph ink) — every page, 390+1440"
PAGES=$(cd $OUT/dist && find . -name index.html -not -path './pagefind/*' | sed 's#^\./##; s#index.html$##' | sort)
for theme in light dark; do
  ALIGN_THEME=$theme node scripts/check-alignment.mjs $OUT/dist $PAGES > $OUT/align-$theme.log 2>&1
  res "$theme: $(tail -1 $OUT/align-$theme.log)"
done

step "7. Overflow sweep + screenshots (single browser)"
node - "$BASEURL" "$OUT" $PAGES <<'EOF' 2>&1 | tee -a $R
const { chromium } = require('@playwright/test');
const [base, out, ...pages] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const bad = [];
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => localStorage.setItem('ccdvp:theme', t), theme);
    const page = await ctx.newPage();
    for (const p of pages) {
      await page.goto(base + p, { waitUntil: 'load' });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width) bad.push(`${theme} ${width}px /${p} scrollWidth=${sw}`);
    }
    // key screenshots
    for (const [name, p, act] of [['home', '', null], ['chapter-top', 'production-integration/reliability/', null],
      ['chapter-lens', 'production-integration/reliability/', '.exam-lens'], ['chapter-end', 'production-integration/reliability/', '.pager'],
      ['durable-diagram', 'agent-architecture/durable-execution/', 'figure.figure'], ['glossary', 'reference/glossary/', null]]) {
      await page.goto(base + p);
      if (act) await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), act);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${out}/shots/${theme}-${width}-${name}.png` });
    }
    if (width === 390) {
      await page.goto(base + 'production-integration/reliability/');
      await page.click('#toc-toggle'); await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/shots/${theme}-390-drawer.png` });
      await page.keyboard.press('Escape');
      await page.click('a.cite'); await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/shots/${theme}-390-citation.png` });
      await page.keyboard.press('Escape');
      await page.click('#search-open'); await page.waitForTimeout(800);
      await page.keyboard.type('retry budget'); await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/shots/${theme}-390-search.png` });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(bad.length ? `- overflow FAIL:\n${bad.map((b) => '  - ' + b).join('\n')}` : `- overflow: OK on ${pages.length} pages × 3 widths × 2 themes`);
})();
EOF

step "8. Playwright suites (--workers=1)"
kill $SRV 2>/dev/null
pnpm exec playwright test --workers=1 --reporter=line > $OUT/e2e.log 2>&1; res "$(grep -E 'passed|failed|flaky|skipped' $OUT/e2e.log | tail -4 | tr '\n' ' ')"

step "9. Done"
res "screenshots: $(ls $OUT/shots | wc -l) in $OUT/shots/"
echo; echo "Report: $R"
