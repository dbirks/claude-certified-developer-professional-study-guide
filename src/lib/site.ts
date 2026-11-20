import { DOMAINS, type Domain, type Skill } from '../data/syllabus';

/** Prefix a site-relative path with the deploy base (works at / and /repo/). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
}

export function skillPath(domain: Domain, skill: Skill): string {
  return `${domain.slug}/${skill.slug}/`;
}

export function referencePath(slug: string): string {
  return `reference/${slug}/`;
}

/** Flat reading order of all skills, for prev/next. */
export function skillOrder(): { domain: Domain; skill: Skill }[] {
  return DOMAINS.flatMap((domain) => domain.skills.map((skill) => ({ domain, skill })));
}
