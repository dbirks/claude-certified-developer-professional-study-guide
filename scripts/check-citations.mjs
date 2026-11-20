#!/usr/bin/env node
// Validate citation yaml files and that every <Cite id="…"> in content resolves.
//   node scripts/check-citations.mjs [slug ...]   (default: all)
// Prints "OK" and exits 0 when clean; lists problems and exits 1 otherwise.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const CDIR = join(ROOT, 'research/citations');
const TAGS = new Set(['FACT', 'REC', 'VER', 'STD']);
const problems = [];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.mdx') ? [p] : [];
  });
}
function frontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  return m ? parse(m[1]) : {};
}
function loadCitations(stem) {
  const file = join(CDIR, stem + '.yaml');
  if (!existsSync(file)) return null;
  let list;
  try {
    list = parse(readFileSync(file, 'utf8')) ?? [];
  } catch (e) {
    problems.push(`${stem}.yaml: YAML parse error: ${e.message.split('\n')[0]}`);
    return new Map();
  }
  const map = new Map();
  for (const [i, c] of list.entries()) {
    const where = `${stem}.yaml[${i}]${c?.id ? ' ' + c.id : ''}`;
    if (!c || typeof c !== 'object') { problems.push(`${where}: not an object`); continue; }
    for (const k of ['id', 'claim', 'tag', 'url', 'title', 'quote', 'accessed']) if (!c[k]) problems.push(`${where}: missing ${k}`);
    if (c.id && !/^F\d+$/.test(String(c.id))) problems.push(`${where}: id must look like F12`);
    if (c.tag && !TAGS.has(c.tag)) problems.push(`${where}: bad tag ${c.tag}`);
    if (c.url && !/^https:\/\//.test(c.url)) problems.push(`${where}: url must be https`);
    if (c.quote && String(c.quote).split(/\s+/).length > 90) problems.push(`${where}: quote longer than 90 words`);
    if (map.has(c.id)) problems.push(`${where}: duplicate id`);
    map.set(c.id, c);
  }
  return map;
}

const only = new Set(process.argv.slice(2));
const files = existsSync(join(ROOT, 'content')) ? walk(join(ROOT, 'content')) : [];
let checked = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const fm = frontmatter(src);
  const stem = fm.citations ?? fm.slug;
  if (only.size && !only.has(fm.slug)) continue;
  checked++;
  const ids = [...src.matchAll(/<Cite\s+id=["']([^"']+)["']\s*\/>/g)].flatMap((m) => m[1].split(/[\s,]+/).filter(Boolean));
  const bad = [...src.matchAll(/<Cite\b(?![^>]*\bid=["'][^"']+["']\s*\/>)[^>]*>/g)];
  for (const b of bad) problems.push(`${file.replace(ROOT, '')}: malformed Cite: ${b[0]}`);
  if (!ids.length) {
    if (fm.kind === 'skill') problems.push(`${file.replace(ROOT, '')}: skill chapter has no citations`);
    continue;
  }
  const cites = loadCitations(stem);
  if (!cites) { problems.push(`${file.replace(ROOT, '')}: no research/citations/${stem}.yaml`); continue; }
  for (const id of new Set(ids)) if (!cites.has(id)) problems.push(`${file.replace(ROOT, '')}: unknown citation ${id}`);
}
// Validate yaml files that no chapter references yet, too.
for (const f of readdirSync(CDIR).filter((f) => f.endsWith('.yaml'))) {
  const stem = f.replace(/\.yaml$/, '');
  if (only.size && !only.has(stem)) continue;
  loadCitations(stem);
}
const uniq = [...new Set(problems)];
if (uniq.length) {
  console.log(uniq.join('\n'));
  console.log(`\n${uniq.length} problem(s) in ${checked} chapter(s).`);
  process.exit(1);
}
console.log('OK');
