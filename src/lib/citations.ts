import { parse } from 'yaml';

/** One verified citation, from research/citations/<slug>.yaml (format: research/PACKET_FORMAT.md). */
export interface Citation {
  id: string; // "F3"
  n: number; // numeric part of id, shown as [3]
  claim: string;
  tag: 'FACT' | 'REC' | 'VER' | 'STD';
  url: string;
  title: string;
  source: string;
  quote: string;
  accessed: string;
  version_note?: string;
}

const files = import.meta.glob('/research/citations/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export function getCitations(stem: string): Citation[] {
  const raw = files[`/research/citations/${stem}.yaml`];
  if (!raw) return [];
  const list = (parse(raw) ?? []) as Omit<Citation, 'n'>[];
  return list
    .map((c) => ({ ...c, accessed: String(c.accessed), n: Number(String(c.id).replace(/\D+/g, '')) }))
    .sort((a, b) => a.n - b.n);
}
