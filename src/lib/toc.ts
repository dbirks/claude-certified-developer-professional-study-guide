import { getCollection, render, type CollectionEntry } from 'astro:content';
import { DOMAINS, type Priority } from '../data/syllabus';
import { referencePath, skillPath, url } from './site';

/**
 * One node of the site-wide table of contents.
 * depth 0 = domain (or the "Reference" group), 1 = chapter, 2/3/4 = H2/H3/H4 inside a chapter.
 */
export interface TocNode {
  id: string; // unique across the whole site: "d-2", "c-reliability", "c-reliability--retry-budgets"
  label: string;
  href: string; // absolute URL including base; headings include #fragment
  depth: 0 | 1 | 2 | 3 | 4;
  kind: 'domain' | 'chapter' | 'heading';
  meta?: { number?: string; weight?: number; priority?: Priority; status?: 'draft' | 'fact-checked' | 'pending' };
  children: TocNode[];
}

type Chapter = CollectionEntry<'chapters'>;

let cache: Promise<TocNode[]> | undefined;

/** Build (once per build) the full nested TOC from the syllabus and the MDX heading ASTs. */
export function getToc(): Promise<TocNode[]> {
  cache ??= buildToc();
  return cache;
}

async function headingNodes(entry: Chapter, chapterId: string, chapterHref: string): Promise<TocNode[]> {
  const { headings } = await render(entry);
  const root: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const h of headings) {
    if (h.depth < 2 || h.depth > 4) continue;
    const node: TocNode = {
      id: `${chapterId}--${h.slug}`,
      label: h.text,
      href: `${chapterHref}#${h.slug}`,
      depth: h.depth as 2 | 3 | 4,
      kind: 'heading',
      children: [],
    };
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    (stack.length ? stack[stack.length - 1].children : root).push(node);
    stack.push(node);
  }
  return root;
}

async function buildToc(): Promise<TocNode[]> {
  const entries = await getCollection('chapters');
  const bySkill = new Map(entries.filter((e) => e.data.kind === 'skill').map((e) => [e.data.skill, e]));
  const nodes: TocNode[] = [];

  for (const domain of DOMAINS) {
    const dNode: TocNode = {
      id: `d-${domain.n}`,
      label: domain.title,
      href: url(`${domain.slug}/${domain.skills[0].slug}/`),
      depth: 0,
      kind: 'domain',
      meta: { number: String(domain.n), weight: domain.weight },
      children: [],
    };
    for (const skill of domain.skills) {
      const entry = bySkill.get(skill.id);
      const href = url(skillPath(domain, skill));
      const id = `c-${skill.slug}`;
      dNode.children.push({
        id,
        label: skill.title,
        href,
        depth: 1,
        kind: 'chapter',
        meta: { number: skill.id, priority: skill.priority, status: entry ? entry.data.status : 'pending' },
        children: entry ? await headingNodes(entry, id, href) : [],
      });
    }
    nodes.push(dNode);
  }

  const refs = entries.filter((e) => e.data.kind === 'reference').sort((a, b) => a.data.order - b.data.order);
  if (refs.length) {
    const rNode: TocNode = {
      id: 'd-ref',
      label: 'Reference',
      href: url(referencePath(refs[0].data.slug)),
      depth: 0,
      kind: 'domain',
      children: [],
    };
    for (const entry of refs) {
      const href = url(referencePath(entry.data.slug));
      const id = `c-${entry.data.slug}`;
      rNode.children.push({
        id,
        label: entry.data.title,
        href,
        depth: 1,
        kind: 'chapter',
        meta: { status: entry.data.status },
        children: await headingNodes(entry, id, href),
      });
    }
    nodes.push(rNode);
  }
  return nodes;
}
