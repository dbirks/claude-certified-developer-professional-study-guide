#!/usr/bin/env node
// Fetch every cited URL and check that each citation's `quote` appears verbatim (after whitespace,
// quote-mark and dash normalization) in the page text. Usage:
//   node scripts/verify-quotes.mjs [slug ...]        (default: all research/citations/*.yaml)
// Writes research/quote-check/<slug>.json and prints a summary. Exit 1 if any quote is not found.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const CDIR = join(ROOT, 'research/citations');
const OUT = join(ROOT, 'research/quote-check');
const CACHE = join(process.env.XDG_CACHE_HOME || join(process.env.HOME, '.cache'), 'ccdvp-quote-cache');
mkdirSync(OUT, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', middot: '·', rarr: '→', larr: '←', times: '×', le: '≤', ge: '≥' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export function norm(s) {
  return decode(String(s))
    .replace(/!?\[([^\]]*)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '$1') // markdown links/images -> text
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFKC')
    .replace(/[‘’‚′`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[ ​‌‍﻿]/g, ' ')
    .replace(/\*\*|__/g, '')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h\d|tr|td|th|pre|br|section|article)>/gi, ' ')
    .replace(/<[^>]+>/g, '');
}
async function fetchText(url) {
  const key = createHash('sha1').update(url).digest('hex');
  const file = join(CACHE, key + '.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const variants = [url.split('#')[0]];
  if (/platform\.claude\.com|code\.claude\.com|docs\.claude\.com/.test(url)) variants.push(url.split('#')[0].replace(/\/$/, '') + '.md');
  let text = '';
  for (const v of variants) {
    try {
      const res = await fetch(v, { headers: { 'user-agent': 'Mozilla/5.0 (study-guide quote checker)', accept: 'text/html,text/markdown,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      if ((res.headers.get('content-type') || '').includes('pdf') || /\.pdf($|\?)/i.test(v)) {
        // PDFs: extract text with pypdf (via uvx) so quotes from papers and slide decks can be checked.
        const pdf = join(tmpdir(), 'ccdvp-' + key + '.pdf');
        writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
        try {
          text += ' ' + execFileSync('uvx', ['--with', 'pypdf', 'python', '-c', 'import pypdf,sys; print(" ".join((p.extract_text() or "") for p in pypdf.PdfReader(sys.argv[1]).pages))', pdf], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
        } catch {}
        continue;
      }
      const body = await res.text();
      // Raw body too: Next.js pages embed content in JSON payloads.
      text += ' ' + htmlToText(body) + ' ' + body.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\u0026/g, '&').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
    } catch {}
  }
  if (text) writeFileSync(file, text);
  return text;
}

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(CDIR).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''));
let failures = 0;
for (const slug of slugs) {
  if (slug === 'component-demo') continue;
  const list = parse(readFileSync(join(CDIR, slug + '.yaml'), 'utf8')) ?? [];
  const results = [];
  const pages = new Map();
  for (const c of list) {
    if (!pages.has(c.url)) pages.set(c.url, norm(await fetchText(c.url)));
    const page = pages.get(c.url);
    const q = norm(c.quote ?? '');
    let status = 'ok';
    if (!page) status = 'fetch-failed';
    else if (!q) status = 'empty-quote';
    else if (!page.includes(q)) {
      // Tolerate markdown/link punctuation differences: retry without punctuation.
      const strip = (s) => s.replace(/[^a-z0-9]+/g, ' ').trim();
      const dehyphen = (t) => t.replace(/-\s+/g, '');
      status = strip(page).includes(strip(q)) || strip(dehyphen(page)).includes(strip(dehyphen(q))) ? 'ok-loose' : 'not-found';
    }
    if (status === 'not-found' || status === 'empty-quote' || status === 'fetch-failed') failures++;
    results.push({ id: c.id, status, url: c.url });
  }
  writeFileSync(join(OUT, slug + '.json'), JSON.stringify(results, null, 2) + '\n');
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`${slug}: ${list.length} citations · ok ${count('ok')} · ok-loose ${count('ok-loose')} · not-found ${count('not-found')} · fetch-failed ${count('fetch-failed')} · empty ${count('empty-quote')}`);
  for (const r of results.filter((r) => !r.status.startsWith('ok'))) console.log(`   ${r.status} ${r.id} ${r.url}`);
}
process.exit(failures ? 1 : 0);
