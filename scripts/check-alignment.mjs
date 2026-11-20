#!/usr/bin/env node
// Measure vertical centering of text inside pills, chips, circles and rows — the *ink* of the glyphs,
// not the line box. For each element: find the text baseline (text Range top + font ascent), get the
// glyph ink extent from canvas measureText (actualBoundingBoxAscent/Descent) with the element's computed
// font, and compare the ink centre with the element's padding-box centre. Flags |offset| > TOL px.
//
//   node scripts/check-alignment.mjs <distDir> [path ...]   (default paths: home, a chapter, a reference page)
//   env: ALIGN_TOL (default 1), ALIGN_WIDTH (default 390), ALIGN_THEME (light|dark)
//
// Exit 1 when any element is off-centre. Uses Playwright's Chromium (already a dev dependency).
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = process.argv[2] || 'dist';
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ['', 'production-integration/reliability/', 'reference/glossary/'];
const TOL = Number(process.env.ALIGN_TOL || 1);
const WIDTHS = (process.env.ALIGN_WIDTH || '390,1440').split(',').map(Number);
const THEME = process.env.ALIGN_THEME || 'light';

// Centred-content components (one element = one centred label). Rows are checked against their own box.
const SELECTORS = [
  '.topbar__title', '.read-pill', '.topbar__search-text', '.topbar__search-key',
  '.status', '.chapter-head__eyebrow', '.toc__badge', '.toc__num', '.toc-controls__btn',
  '.toc__item[data-depth="1"] > .toc__row .toc__label',
  '.cite', '.source__n', '.cite-pop__n', '.self-check__badge', '.exam-lens__n',
  '.pager__dir', '.signal-table__tag', '[class*="domain-card__n"]', '[class*="domain-card__w"]',
  '[class*="skill-row"] [class*="num"]', '[class*="skill-row"] [class*="title"]', '[class*="stat"]',
  '.home-head [class*="pill"]',
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
  if (base !== '/' && p.startsWith(base)) p = '/' + p.slice(base.length);
  let f = join(dist, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const probe = ({ selectors, tol }) => {
  const ctx = document.createElement('canvas').getContext('2d');
  const out = [];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      // first non-empty direct-or-nested text node
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 3) });
      const tn = walker.nextNode();
      if (!tn) continue;
      const host = tn.parentElement;
      const cs = getComputedStyle(host);
      if (host.closest('.sr-only')) continue;
      const text = tn.textContent.trim();
      // Baseline without touching layout: a text Range's rect spans the font's ascent+descent content area.
      const range = document.createRange();
      range.selectNodeContents(tn);
      const rects = range.getClientRects();
      const rr = rects[0];
      if (!rr || rects.length > 1) continue; // multi-line labels are not single centred labels
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(text);
      const baseline = rr.top + m.fontBoundingBoxAscent;
      const inkTop = baseline - m.actualBoundingBoxAscent;
      const inkBottom = baseline + m.actualBoundingBoxDescent;
      const es = getComputedStyle(el);
      const top = r.top + parseFloat(es.borderTopWidth);
      const bottom = r.bottom - parseFloat(es.borderBottomWidth);
      const offset = (inkTop + inkBottom) / 2 - (top + bottom) / 2;
      if (Math.abs(offset) > tol) out.push({ sel, text: text.slice(0, 24), offset: Math.round(offset * 10) / 10, h: Math.round(r.height) });
    }
  }
  return out;
};

const browser = await chromium.launch();
let bad = 0;
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript((t) => localStorage.setItem('ccdvp:theme', t), THEME);
  for (const p of paths) {
    await page.goto(`http://localhost:${port}${(process.env.BASE_PATH || '/').replace(/\/?$/, '/')}${p}`);
    await page.evaluate(() => document.fonts.ready);
    const res = await page.evaluate(probe, { selectors: SELECTORS, tol: TOL });
    // collapse duplicates per selector
    const groups = new Map();
    for (const r of res) {
      const k = `${r.sel} ${r.offset}`;
      if (!groups.has(k)) groups.set(k, { ...r, n: 0 });
      groups.get(k).n++;
    }
    for (const g of groups.values()) {
      bad++;
      console.log(`${width}px /${p}  ${g.sel}  "${g.text}"  ink offset ${g.offset > 0 ? '+' : ''}${g.offset}px (box ${g.h}px) ×${g.n}`);
    }
  }
  await page.close();
}
await browser.close();
server.close();
console.log(bad ? `\n${bad} off-centre group(s) (tolerance ${TOL}px; + = text sits low)` : `OK: all measured labels centred within ${TOL}px`);
process.exit(bad ? 1 : 0);
