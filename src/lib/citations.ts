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
  match?: 'ok' | 'ok-loose'; // scripts/verify-quotes.mjs result: quote found verbatim (ok) or after normalization (ok-loose)
}

const files = import.meta.glob('/research/citations/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

const checks = import.meta.glob('/research/quote-check/*.json', { import: 'default', eager: true }) as Record<
  string,
  { id: string; status: string }[]
>;

export function getCitations(stem: string): Citation[] {
  const raw = files[`/research/citations/${stem}.yaml`];
  if (!raw) return [];
  const list = (parse(raw) ?? []) as Omit<Citation, 'n'>[];
  const status = new Map((checks[`/research/quote-check/${stem}.json`] ?? []).map((r) => [r.id, r.status]));
  return list
    .map((c) => {
      const st = status.get(String(c.id));
      return {
        ...c,
        accessed: String(c.accessed),
        n: Number(String(c.id).replace(/\D+/g, '')),
        match: st === 'ok' || st === 'ok-loose' ? (st as 'ok' | 'ok-loose') : undefined,
      };
    })
    .sort((a, b) => a.n - b.n);
}
