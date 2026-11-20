#!/usr/bin/env node
// Check internal links and fragment targets in the built site.
//   node scripts/check-links.mjs [distDir=dist]     BASE_PATH env = deploy base (default "/")
// Verifies every href/src that starts with the base resolves to a built file, and that #fragments exist
// on the target page. Also fails on duplicate element ids within a page. External links are not fetched.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const dist = process.argv[2] || 'dist';
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const problems = [];
const idCache = new Map();

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    idCache.set(file, ids);
  }
  return idCache.get(file);
}
function resolve(pathname) {
  // pathname has the base stripped; map to a file in dist
  const clean = decodeURIComponent(pathname.split('?')[0]);
  const candidates = clean.endsWith('/') || clean === '' ? [join(dist, clean, 'index.html')] : [join(dist, clean), join(dist, clean, 'index.html'), join(dist, clean + '.html')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

const pages = walk(dist).filter((f) => f.endsWith('.html') && !f.includes('/pagefind/'));
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const rel = page.slice(dist.length);
  const ids = idsOf(page);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const d of new Set(dup)) problems.push(`${rel}: duplicate id "${d}"`);
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const link = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|data:|javascript:|tel:)/.test(link)) continue;
    let target = page;
    let frag = '';
    if (link.startsWith('#')) {
      frag = link.slice(1);
    } else if (link.startsWith('/')) {
      if (!link.startsWith(base)) { problems.push(`${rel}: link outside base ${base}: ${link}`); continue; }
      const [p, f = ''] = link.slice(base.length).split('#');
      target = resolve(p);
      frag = f;
      if (!target) { problems.push(`${rel}: broken link ${link}`); continue; }
    } else {
      const [p, f = ''] = link.split('#');
      const abs = join(dirname(page), p);
      target = existsSync(abs) && statSync(abs).isFile() ? abs : existsSync(join(abs, 'index.html')) ? join(abs, 'index.html') : undefined;
      frag = f;
      if (!target) { problems.push(`${rel}: broken relative link ${link}`); continue; }
    }
    if (frag && target.endsWith('.html') && !idsOf(target).includes(decodeURIComponent(frag))) {
      problems.push(`${rel}: missing fragment #${frag} in ${target.slice(dist.length)}`);
    }
  }
}
if (problems.length) {
  console.log([...new Set(problems)].join('\n'));
  console.log(`\n${problems.length} link problem(s) across ${pages.length} pages.`);
  process.exit(1);
}
console.log(`OK: ${pages.length} pages, internal links and fragments resolve.`);
