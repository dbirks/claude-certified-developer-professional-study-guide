#!/usr/bin/env node
// Page-weight audit for a built CCDV-P dist dir. Report only: reads dist, prints markdown.
//
//   node scripts/size-report.mjs .ccdvp-perf/dist
//   node scripts/size-report.mjs dist --page chapter=production-integration/reliability/index.html
//   node scripts/size-report.mjs dist --json
//
// For each page it walks: HTML -> linked stylesheets -> @font-face files, and
// HTML -> module <script> -> its import graph inside dist/_astro. Fonts are
// matched against the unicode-range of every @font-face using the codepoints
// actually present in the page text, so "what a Latin page really downloads"
// is measured, not guessed.
//
// Transfer estimate: gzip(level 9) for compressible text (HTML/CSS/JS) + raw
// bytes for woff2 (already Brotli-compressed; gzipping it is a no-op).

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

// ---------------------------------------------------------------- argv

const argv = process.argv.slice(2);
const distArg = argv.find((a) => !a.startsWith('--'));
if (!distArg || !fs.existsSync(distArg)) {
  console.error('usage: node scripts/size-report.mjs <distDir> [--page label=path.html]... [--json]');
  process.exit(2);
}
const DIST = path.resolve(distArg);
const AS_JSON = argv.includes('--json');
const pageOverrides = argv
  .filter((a) => a.startsWith('--page='))
  .map((a) => a.slice('--page='.length))
  .map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? { label: path.basename(path.dirname(a)), rel: a } : { label: a.slice(0, i), rel: a.slice(i + 1) };
  });

const fmt = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KiB` : `${n} B`);
const sumRaw = (a) => a.reduce((x, y) => x + y.bytes, 0);
const sum2 = (a) => a.reduce((x, y) => x + y.gzip, 0);
const raw = (rel) => fs.readFileSync(path.join(DIST, rel));
const exists = (rel) => fs.existsSync(path.join(DIST, rel));
const gzipBytes = (buf) => gzipSync(buf, { level: 9 }).length;
const isFont = (f) => /\.(woff2?|ttf|otf|eot)$/i.test(f);
const SUBSET_RE = /-(latin-ext|latin|cyrillic-ext|cyrillic|greek|vietnamese|math|symbols)-(?:\d|wght|normal|italic)/i;
const walkFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = path.join(dir, e.name);
    return e.isDirectory() ? walkFiles(abs) : [path.relative(DIST, abs).split(path.sep).join('/')];
  });

function mdTable(rows) {
  if (!rows.length) return '_none_';
  const head = Object.keys(rows[0]);
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const r of rows) lines.push(`| ${head.map((h) => String(r[h] ?? '')).join(' | ')} |`);
  return lines.join('\n');
}

// ------------------------------------------------------- asset resolving

/** basename -> dist-relative path, so hrefs work with or without a base path. */
const ALL_FILES = walkFiles(DIST);
const byName = new Map();
for (const f of ALL_FILES) if (!byName.has(path.posix.basename(f))) byName.set(path.posix.basename(f), f);

/** dist-relative path for an href/src, or null when the file is not in dist. */
function resolveAsset(href, fromFile) {
  if (!href || /^(https?:)?\/\//i.test(href) || href.startsWith('data:') || href.startsWith('#')) return null;
  const clean = decodeURI(href.split(/[?#]/)[0]);
  const cands = clean.startsWith('/') ? [clean.slice(1)] : [path.posix.join(path.posix.dirname(fromFile), clean)];
  for (const c of cands) if (exists(c)) return c;
  return byName.get(path.posix.basename(clean)) ?? null;
}

// ------------------------------------------------------------- HTML bits

function pageAssets(html, self) {
  const styles = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel=["']?stylesheet/i.test(tag)) continue;
    const f = resolveAsset((tag.match(/href=["']([^"']+)["']/i) ?? [])[1], self);
    if (f) styles.push(f);
  }

  const jsEntry = [];
  let inlineJs = 0;
  let inlineJsCount = 0;
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = (attrs.match(/src=["']([^"']+)["']/i) ?? [])[1];
    if (src) {
      const f = resolveAsset(src, self);
      if (f) jsEntry.push(f);
    } else if (body.trim()) {
      inlineJs += Buffer.byteLength(body);
      inlineJsCount += 1;
    }
  }

  return {
    styles: [...new Set(styles)],
    jsEntry,
    inlineJs,
    inlineJsCount,
    inlineStyleAttrs: [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]),
  };
}

/** BFS over `from"..."` / `import"..."` / `import("...")` inside the JS files. */
function jsGraph(entryFiles) {
  const seen = new Set();
  const queue = [...entryFiles];
  while (queue.length) {
    const f = queue.shift();
    if (!f || seen.has(f) || !exists(f) || !f.endsWith('.js')) continue;
    seen.add(f);
    const code = raw(f).toString('utf8');
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+|\/[^"']+)["']/g)) {
      const dep = resolveAsset(m[1], f);
      if (dep && dep.endsWith('.js') && !seen.has(dep)) queue.push(dep);
    }
  }
  return [...seen];
}

// ------------------------------------------------------------ font faces

function parseUnicodeRange(str) {
  const ranges = [];
  for (const part of (str ?? '').split(',')) {
    const p = part.trim().toUpperCase().replace(/\s+/g, '');
    const m = p.match(/^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/);
    if (!m) continue;
    const lo = parseInt(m[1].replace(/\?/g, '0'), 16);
    const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'F'), 16);
    ranges.push([lo, Math.max(lo, hi)]);
  }
  return ranges;
}

/** @font-face rules of the given CSS files -> face records with file sizes. */
function fontFaces(cssFiles) {
  const faces = [];
  for (const css of cssFiles) {
    const text = raw(css).toString('utf8');
    for (const m of text.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
      const block = m[1];
      const prop = (name) => (block.match(new RegExp(`${name}:\\s*([^;}]+)`, 'i')) ?? [])[1]?.trim() ?? '';
      const urls = [...block.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((u) => u[1]);
      const dataUri = urls.find((u) => u.startsWith('data:'));
      const woff2 = urls.find((u) => /\.woff2(\?|$)/i.test(u)) ?? urls.find((u) => !u.startsWith('data:'));
      const file = woff2 ? resolveAsset(woff2, css) : null;
      const face = {
        family: prop('font-family').replace(/["']/g, ''),
        weight: prop('font-weight') || '400',
        style: prop('font-style') || 'normal',
        display: prop('font-display') || 'auto',
        ranges: parseUnicodeRange(prop('unicode-range')),
        subset: SUBSET_RE.test(path.posix.basename(file ?? woff2 ?? ''))
          ? path.posix.basename(file ?? woff2 ?? '').match(SUBSET_RE)[1]
          : dataUri
            ? 'inline'
            : 'full',
        inline: !!dataUri && !woff2,
        file,
      };
      if (face.inline) face.bytes = Math.round((dataUri.split(',')[1]?.length ?? 0) * 0.75);
      else if (file && exists(file)) face.bytes = raw(file).length;
      else face.bytes = 0;
      face.gzipped = face.file && exists(face.file) && !isFont(face.file) ? gzipBytes(raw(face.file)) : face.bytes;
      faces.push(face);
    }
  }
  return faces;
}

/** Concrete font families the CSS actually applies to text (custom-property chains expanded). */
function appliedFamilies(cssFiles) {
  const vars = new Map();
  const decls = [];
  for (const css of cssFiles) {
    const text = raw(css).toString('utf8').replace(/@font-face\s*\{[\s\S]*?\}/g, '');
    for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
    for (const m of text.matchAll(/font-family\s*:\s*([^;}!]+)/g)) decls.push(m[1]);
  }
  const expand = (v, depth = 0) =>
    depth > 6 ? v : v.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, n) => expand(vars.get(n) ?? '', depth + 1));
  const fallbacks = /^(dejavu|georgia|segoe|apple|system-ui|ui-monospace|serif|sans-serif|monospace|inherit|initial|unset|revert)$/i;
  const out = new Set();
  for (const d of decls) {
    for (const fam of expand(d).split(',')) {
      const name = fam.trim().replace(/["']/g, '');
      if (name && !fallbacks.test(name)) out.add(name);
    }
  }
  return out;
}

/** Codepoints of text a browser would lay out on this page (tags/scripts/styles removed). */
function pageCodepoints(html) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCp(parseInt(d, 10)))
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
  const cps = new Set();
  for (const ch of text) cps.add(ch.codePointAt(0));
  return cps;
}
const safeCp = (n) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ');
const inRange = (ranges, cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

// -------------------------------------------------------- html anatomy

function section(html, startMarker, endMarker, label) {
  const a = html.indexOf(startMarker);
  if (a < 0) return { label, bytes: 0, gzipped: 0 };
  const b = html.indexOf(endMarker, a);
  const body = html.slice(a, b < 0 ? html.length : b);
  return { label, bytes: Buffer.byteLength(body), gzipped: gzipBytes(Buffer.from(body)) };
}

function htmlAnatomy(html) {
  const headEnd = html.indexOf('</head>');
  const styleAttrs = [...html.matchAll(/style="([^"]*)"/g)];
  const shiki = styleAttrs.filter((m) => m[1].includes('--shiki'));
  return {
    rows: [
      { label: 'head + inline theme script', bytes: headEnd, gzipped: gzipBytes(Buffer.from(html.slice(0, headEnd))) },
      section(html, '<nav class="toc"', '</aside>', 'TOC nav (sidebar + drawer tree)'),
      section(html, '<article', '</article>', 'article (page body)'),
      section(html, '<nav class="pager"', '</nav>', 'pager'),
      section(html, '<dialog', '</dialog>', 'search dialog markup'),
      { label: 'all inline style="" attributes', bytes: styleAttrs.reduce((a, m) => a + Buffer.byteLength(m[0]), 0), gzipped: 0 },
    ],
    shiki: {
      attrs: shiki.length,
      bytes: shiki.reduce((a, m) => a + Buffer.byteLength(m[0]), 0),
      identicalLightDark: shiki.filter((m) => /--shiki-light:\s*([^;]+);\s*--shiki-dark:\s*\1(?![0-9a-fA-F])/.test(m[1])).length,
    },
  };
}

// ---------------------------------------------------------------- main

const DEFAULT_PAGES = [
  { label: 'home', rel: 'index.html' },
  { label: 'chapter', rel: 'production-integration/reliability/index.html' },
  { label: 'reference', rel: 'reference/glossary/index.html' },
];
const HTML_PAGES = ALL_FILES.filter((f) => f.endsWith('index.html') && !f.startsWith('pagefind/'));

function resolvePage(p) {
  const rel = p.rel.replace(/^\.?\//, '');
  if (exists(rel)) return { label: p.label, rel };
  // sample moved: fall back to a same-kind page so the audit still runs
  const alt = p.label === 'home' ? 'index.html' : p.label === 'reference' ? HTML_PAGES.find((f) => f.startsWith('reference/')) : HTML_PAGES.find((f) => f.split('/').length === 3);
  return alt && exists(alt) ? { label: `${p.label} (alt)`, rel: alt } : null;
}
const requested = pageOverrides.length ? pageOverrides : DEFAULT_PAGES;
const pages = requested.map(resolvePage).filter(Boolean);
if (!pages.length) {
  console.error(`no pages found under ${DIST}`);
  process.exit(2);
}

const pageDetail = [];
for (const p of pages) {
  const html = raw(p.rel).toString('utf8');
  const htmlBuf = Buffer.from(html);
  const { styles, jsEntry, inlineJs, inlineJsCount, inlineStyleAttrs } = pageAssets(html, p.rel);
  const jsFiles = jsGraph(jsEntry);
  const faces = fontFaces(styles);
  const applied = appliedFamilies(styles);
  const cps = [...pageCodepoints(html)];

  for (const f of faces) {
    f.familyUsed = applied.has(f.family);
    f.needed = f.familyUsed && f.ranges.length > 0 && f.ranges.some((r) => cps.some((cp) => inRange([r], cp)));
  }
  const needed = new Map(); // a browser fetches at most one file per @font-face
  for (const f of faces) if (f.needed && f.file && /\.woff2$/i.test(f.file)) needed.set(f.file, f.bytes);

  const fontBytes = [...needed.values()].reduce((a, b) => a + b, 0);
  const cssList = styles.map((file) => ({ file, bytes: raw(file).length, gzip: gzipBytes(raw(file)) }));
  const jsList = jsFiles.map((file) => ({ file, bytes: raw(file).length, gzip: gzipBytes(raw(file)) }));
  const transfer = gzipBytes(htmlBuf) + sum2(cssList) + sum2(jsList) + fontBytes + inlineJs;

  pageDetail.push({
    page: p.label,
    html: p.rel,
    htmlBytes: Buffer.byteLength(htmlBuf),
    htmlGzip: gzipBytes(htmlBuf),
    css: cssList,
    js: { entry: jsEntry, graph: jsList },
    inlineJsBytes: inlineJs,
    inlineJsTags: inlineJsCount,
    inlineStyleAttrs: inlineStyleAttrs.length,
    fontsNeeded: [...needed.entries()].map(([file, bytes]) => ({ file, bytes })),
    fontBytes,
    transfer,
    fontFaces: faces,
    anatomy: htmlAnatomy(html),
  });
}

// Shared asset inventory (bytes per file, deduped across audited pages).
const inv = new Map();
for (const d of pageDetail) {
  for (const c of [...d.css, ...d.js.graph]) if (!inv.has(c.file)) inv.set(c.file, { file: c.file, type: c.file.endsWith('.css') ? 'css' : 'js', bytes: c.bytes, gzip: c.gzip });
}
for (const f of ALL_FILES.filter((f) => f.startsWith('_astro/') && isFont(f))) {
  const b = raw(f).length;
  inv.set(f, { file: f, type: 'font', bytes: b, gzip: isFont(f) ? b : gzipBytes(raw(f)) });
}
const inventory = [...inv.values()].sort((a, b) => b.bytes - a.bytes);

const facesAll = pageDetail[0]?.fontFaces ?? [];
const woff2Faces = facesAll.filter((f) => f.file?.endsWith('.woff2'));
const neededLabels = new Set(pageDetail.flatMap((d) => d.fontFaces.filter((f) => f.needed).map((f) => `${f.family} ${f.subset} ${f.weight}`)));
const neverNeeded = woff2Faces.filter((f) => !neededLabels.has(`${f.family} ${f.subset} ${f.weight}`));
const neverNeededBytes = neverNeeded.reduce((a, f) => a + f.bytes, 0);
const fontsOnDisk = [...inv.values()].filter((i) => i.type === 'font').reduce((a, i) => a + i.bytes, 0);
const woff2OnDisk = [...inv.values()].filter((i) => i.type === 'font' && i.file.endsWith('.woff2')).reduce((a, i) => a + i.bytes, 0);
const pagefindBytes = exists('pagefind') ? walkFiles(path.join(DIST, 'pagefind')).reduce((a, f) => a + raw(f).length, 0) : 0;
const distBytes = ALL_FILES.reduce((a, f) => a + raw(f).length, 0);
const fixedPerPage = pageDetail[0] ? sum2(pageDetail[0].css) + sum2(pageDetail[0].js.graph) : 0;

if (AS_JSON) {
  console.log(JSON.stringify({ dist: DIST, pagesBuilt: HTML_PAGES.length, pages: pageDetail, inventory, fixedGzipPerPage: fixedPerPage, fontsOnDisk, woff2OnDisk, neverNeededBytes, pagefindBytes, distBytes }, null, 2));
  process.exit(0);
}

const L = [];
L.push(`# Size report — \`${path.relative(process.cwd(), DIST) || '.'}\``, '');
L.push(
  `Pages built: ${HTML_PAGES.length} · dist total ${fmt(distBytes)} · fonts in \`_astro/\` ${fmt(fontsOnDisk)} (woff2 ${fmt(woff2OnDisk)}) · pagefind index ${fmt(pagefindBytes)} (fetched only when search opens)`,
  '',
);

L.push('## Per-page weight', '');
L.push(
  mdTable(
    pageDetail.map((d) => ({
      Page: `**${d.page}**`,
      'HTML (dist-relative)': d.html,
      'HTML raw': fmt(d.htmlBytes),
      'HTML gzip': fmt(d.htmlGzip),
      'CSS raw': fmt(sumRaw(d.css)),
      'CSS gzip': fmt(sum2(d.css)),
      'JS raw': fmt(sumRaw(d.js.graph)),
      'JS gzip': fmt(sum2(d.js.graph)),
      'inline JS': fmt(d.inlineJsBytes),
      'woff2 needed raw': fmt(d.fontBytes),
      'files': d.fontsNeeded.length,
      'Transfer est.': fmt(d.transfer),
    })),
  ),
);
L.push('', '> CSS raw/gzip both read the same file (single bundled stylesheet); transfer est. = gzip(HTML) + gzip(CSS) + gzip(JS graph) + raw woff2 bytes actually needed + inline JS. woff2 is already Brotli-compressed, so it is counted raw.', '');

L.push('## What the raw HTML bytes are', '');
L.push(
  mdTable(
    pageDetail.flatMap((d) =>
      d.anatomy.rows.map((r) => ({
        Page: `**${d.page}**`,
        Part: r.label,
        Raw: fmt(r.bytes),
        Gzip: r.gzipped ? fmt(r.gzipped) : '—',
        '% of page HTML': d.htmlBytes ? `${((r.bytes / d.htmlBytes) * 100).toFixed(1)}%` : '0%',
      })),
    ),
  ),
);
L.push('', '### Shiki code-token inline styles (`--shiki-light` / `--shiki-dark`)', '');
L.push(
  mdTable(
    pageDetail.map((d) => ({
      Page: `**${d.page}**`,
      'style="" attrs': d.inlineStyleAttrs,
      'shiki style attrs': d.anatomy.shiki.attrs,
      'shiki bytes': fmt(d.anatomy.shiki.bytes),
      'attrs where light==dark value': d.anatomy.shiki.identicalLightDark,
    })),
  ),
);

L.push('', '## @font-face inventory (parsed out of the built CSS)', '');
L.push(
  mdTable(
    facesAll.map((f) => ({
      Family: f.family,
      'font-weight': f.weight,
      'font-display': f.display,
      Subset: f.subset,
      File: f.inline ? '(base64 data-URI, inside the CSS)' : (f.file ?? '(not found in dist)'),
      Bytes: fmt(f.bytes),
      'Needed by audited page text?': f.needed ? 'YES' : f.familyUsed ? 'no — subset not used by page text' : 'no — family never applied by CSS',
    })),
  ),
);
L.push(
  '',
  `- @font-face rules: ${facesAll.length}; woff2 files referenced: ${woff2Faces.length}; woff2 on disk: ${fmt(woff2OnDisk)}; every font file in \`_astro/\`: ${fmt(fontsOnDisk)}`,
  `- Faces a Latin page actually fetches: ${neededLabels.size} — ${[...neededLabels].join(' · ') || 'none'}`,
  '- A face counts as "needed" when the family is applied by CSS **and** one of the page\'s text codepoints falls in its `unicode-range`. Font weight/style is not resolved per element, so a family shipped in several static weights (e.g. DM Mono 400 + 500) is counted for both; cross-check against a real load (Lighthouse network requests) before acting.',
  `- woff2 faces never needed by any audited page: ${neverNeeded.length} / ${fmt(neverNeededBytes)} on disk${neverNeeded.length ? ` (${neverNeeded.map((f) => `${f.family} ${f.subset}`).join(', ')})` : ''}`,
  '',
);

L.push('## Asset inventory (_astro/)', '');
L.push(mdTable(inventory.map((i) => ({ File: i.file, Type: i.type, Raw: fmt(i.bytes), Gzip: i.type === 'font' ? '— (already compressed)' : fmt(i.gzip) }))));
L.push('', `Fixed payload every navigation re-pays (CSS + JS gzip): **${fmt(fixedPerPage)}** × ${HTML_PAGES.length} pages = ${fmt(fixedPerPage * HTML_PAGES.length)} duplicated gzip bytes site-wide.`, '');

console.log(L.join('\n'));
