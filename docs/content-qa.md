# Content QA sweep

Presentation-only QA of the 25 skill chapters and 3 reference pages (`api-reference`,
`building-blocks`, `glossary`), plus a light pass over the intro. Facts, numbers, identifiers and
cites were **not** touched — only leftover drafting artifacts were removed and visibly broken MDX
was fixed (none found). Everything else is reported, not edited.

- **Method:** full static build to `.ccdvp-qa/dist` (`pnpm astro build`), then grep of the built
  `index.html` text for literal `<Cite`, stray `**`, empty/again-rendered headings; plus a source
  analyzer (`.ccdvp-qa/analyze.mjs`) over the MDX for headings, tables, code fences, prose length,
  `<Cite>` / `<SelfCheck>` / `<ExamLens>` counts and malformed tags.
- **Verify:** `node scripts/check-citations.mjs` → `OK`; `pnpm astro build` completes.
- **No browsers** were used (per task): no Playwright / Lighthouse / check-alignment.

## Summary of findings (in scope: 25 skills + 3 reference + intro)

| Check | In-scope count | Action |
|---|---:|---|
| Drafting artifacts referencing internal research notes | 2 | **Fixed** (see below) |
| Duplicated "Exam lens" label (`## Exam lens` H2 + ExamLens card titled "Exam lens") | 27 | Reported only |
| Empty section (heading directly followed by another heading) | 2 | Reported (benign H2→H3 group header) |
| Table wider than 6 columns | 2 | Reported only |
| Paragraph > 180 words | 0 | Longest 176 (see notes) |
| Skill chapter with no `<Cite>` | 0 | — |
| Skill chapter with < 2 `<SelfCheck>` | 0 (all have 3) | — |
| Skill chapter missing an Exam lens | 0 | — |
| Code block without a language | 0 | — |
| Malformed `<Cite>` / literal `<Cite` rendered as text | 0 | — |
| Stray `**` rendered as visible text | 0 (all `**` are inside code blocks) | — |
| Heading with trailing colon | 0 | — |
| Typographical slips | 1 | Reported only |

## Safe edits made (2)

Both remove an internal-provenance phrase (research "packet" / "study notes"); every factual clause
is preserved verbatim.

1. `content/04-debugging/02-incident-response.mdx:135` — lead-in to the eval-spec code block
   - Before: `The packet's illustrative eval spec (pseudocode; grader names are placeholders, not an Anthropic schema):`
   - After: `An illustrative eval spec (pseudocode; grader names are placeholders, not an Anthropic schema):`
2. `content/01-agent-architecture/03-architecture-selection.mdx:53` — intro to the hypothetical table
   - Before: `These figures are a hypothetical from the study notes, not a benchmark: …`
   - After: `These figures are a hypothetical, not a benchmark: …`

## Findings by page

Only pages with a finding beyond the global "Exam lens" duplication are listed individually; the
duplication itself is tabulated in the next section.

- **`02-production-integration/02-scale-throughput.mdx` (skill 2.2)**
  - L35 `## Rate-limit strategy` — heading immediately followed by `### Tiers, model buckets, and version drift` (H2 group header with no lead text; benign but matches the "empty section" pattern).
  - L143 markdown table has **7 columns** (Condition · Charged input/request · Actual output/request · RPM load · ITPM load · OTPM load · Tightest). Exceeds the 6-column guideline; may overflow narrow viewports. Report only.
- **`04-debugging/01-failure-diagnosis.mdx` (skill 4.1)**
  - L85 `## Refusals and non-deterministic failures` — heading immediately followed by `### Refusals are successful responses` (benign H2→H3 group header).
- **`03-observability/03-trace-analysis.mdx` (skill 3.3)**
  - L104 markdown table has **7 columns** (Cohort · Attempts · Failures · Failure rate · Lookup ≥4 s · Failures among ≥4 s · Failures among <4 s). Report only.
- **`03-observability/01-telemetry.mdx` (skill 3.1)**
  - L223 `These decision patterns are editorial inferences from the objective and documentation.` — the ExamLens disclaimer here names its provenance ("the objective and documentation"). Other chapters use the neutral phrasing "…not exam questions" (e.g. 1.3 L165, 7.2 L223, 2.2 L205, 2.3 L212, 1.4 L125). Not a factual statement and not in the allowed-artifact class, so **left in place** — recommend rewording to match the neutral template.
- **`04-debugging/02-incident-response.mdx` (skill 4.2)**
  - L133 `…mutating tool calls within one session ; calibrate…` — a stray space before the semicolon (`session ;`). Typo; not an artifact/MDX-syntax defect, so **reported, not fixed**.
  - L135 packet artifact — **fixed** (see above).
- **`01-agent-architecture/03-architecture-selection.mdx` (skill 1.3)**
  - L163 `## Exam lens` — the card does **not** immediately follow: an editorial lead-in sits between (L165). Still the redundant H2 + card-label pair; the lead-in is the cleaner pattern the other chapters could adopt. L53 study-notes artifact — **fixed** (see above).

## Global finding — duplicated "Exam lens" label (27 pages, report only)

Every chapter below has an `## Exam lens` **H2** whose visible text is "Exam lens", immediately
followed (or, for 1.3, separated by one lead-in line) by an `<ExamLens>` card that renders its own
visible "Exam lens" title (`ExamLens.astro` → `.exam-lens__name`). A reader therefore sees the label
twice in a row. Per the task this is counted, not changed. Line numbers of the `## Exam lens` H2:

1.1 L257 · 1.2 L162 · 1.3 L163 (lead-in at L165) · 1.4 L121 · 2.1 L220 · 2.2 L201 · 2.3 L208 ·
2.4 L184 · 3.1 L219 · 3.2 L174 · 3.3 L152 · 4.1 L150 · 4.2 L194 · 5.1 L227 · 5.2 L216 · 5.3 L146 ·
6.1 L175 · 6.2 L143 · 7.1 L213 · 7.2 L220 · 7.3 L147 · 8.1 L191 · 8.2 L208 · 8.3 L163 · 8.4 L199 ·
reference/building-blocks L139 · reference/glossary L241.

(`reference/api-reference.mdx` has an ExamLens card but **no** `## Exam lens` H2, so it is not part of
this duplication.) Note the `## Self-check` H2 + `<SelfCheck>` cards are **not** duplicated — the
SelfCheck card shows a Q/A badge, not the words "Self-check".

## Checks that came back clean

- **Paragraph length:** no in-scope paragraph exceeds 180 words. Longest: 176 words
  (`01-agent-architecture/02-durable-execution.mdx:112`) and 173 words
  (`08-agent-fleets/03-unattended-operations.mdx:40`) — both under threshold, flagged only as a
  near-miss in case the owner wants to trim.
- **Code fences:** every fenced block declares a language; no ` ``` ` without one.
- **Citations:** every skill chapter cites; `node scripts/check-citations.mjs` → `OK`; no malformed
  `<Cite>` and no literal `<Cite` leaked into rendered HTML.
- **Self-checks:** all 25 skill chapters have exactly 3; building-blocks and glossary have 3;
  api-reference has 0 (acceptable for that reference).
- **Exam lens:** present on all 25 skill chapters.
- **Rendering:** the only visible `**` in built HTML sit inside shiki code blocks (Python `**`
  exponent / dict-unpack and glob patterns such as `"prompts/**"`, `Read(~/.ssh/**)`) — not broken
  bold. No stray `**` in prose.
- **Headings:** no `#` H1s in prose (the `# …` matches were Python/bash comments inside code
  fences), no heading with a trailing colon, no same-level empty section.

## Out of scope

- `content/reference/component-demo.mdx` — test fixture, not built in this sweep.
- `content/practice/domain-1…8.mdx` — 8 practice pages (`kind: reference`), not part of the stated
  25+3. Scanned anyway: the only "packet" hits there (`domain-6.mdx:34,86` — "policy packet",
  "precedent packet") are legitimate problem-statement vocabulary, not artifacts.
- `content/reference/exam-day-review.mdx` — a new `kind: reference` page created by another worker
  **during** this run (build went 29→30 pages between passes). It reports 8 "empty section" findings
  (each `## Domain N …` H2 immediately followed by an `###` subsection) plus its own structure. It is
  not one of the 3 reference pages in scope and I did not edit it — flagging for whoever owns it.

## Per-page counts

| Page (content/) | Kind | Skill | Cites | Self-checks | Exam lens |
|---|---|---|---:|---:|:--:|
| 00-introduction.mdx | intro | — | 0 | 0 | no |
| 01-agent-architecture/01-multi-agent-orchestration.mdx | skill | 1.1 | 138 | 3 | yes |
| 01-agent-architecture/02-durable-execution.mdx | skill | 1.2 | 109 | 3 | yes |
| 01-agent-architecture/03-architecture-selection.mdx | skill | 1.3 | 63 | 3 | yes |
| 01-agent-architecture/04-context-memory.mdx | skill | 1.4 | 59 | 3 | yes |
| 02-production-integration/01-reliability.mdx | skill | 2.1 | 119 | 3 | yes |
| 02-production-integration/02-scale-throughput.mdx | skill | 2.2 | 80 | 3 | yes |
| 02-production-integration/03-mcp-change-management.mdx | skill | 2.3 | 78 | 3 | yes |
| 02-production-integration/04-retrieval-grounding.mdx | skill | 2.4 | 86 | 3 | yes |
| 03-observability/01-telemetry.mdx | skill | 3.1 | 98 | 3 | yes |
| 03-observability/02-monitoring-alerting.mdx | skill | 3.2 | 114 | 3 | yes |
| 03-observability/03-trace-analysis.mdx | skill | 3.3 | 71 | 3 | yes |
| 04-debugging/01-failure-diagnosis.mdx | skill | 4.1 | 82 | 3 | yes |
| 04-debugging/02-incident-response.mdx | skill | 4.2 | 98 | 3 | yes |
| 05-evaluation/01-evaluation-design.mdx | skill | 5.1 | 80 | 3 | yes |
| 05-evaluation/02-llm-as-judge.mdx | skill | 5.2 | 84 | 3 | yes |
| 05-evaluation/03-online-quality.mdx | skill | 5.3 | 49 | 3 | yes |
| 06-cost-latency/01-cost-architecture.mdx | skill | 6.1 | 84 | 3 | yes |
| 06-cost-latency/02-latency-engineering.mdx | skill | 6.2 | 62 | 3 | yes |
| 07-security/01-runtime-guardrails.mdx | skill | 7.1 | 86 | 3 | yes |
| 07-security/02-threat-defense.mdx | skill | 7.2 | 86 | 3 | yes |
| 07-security/03-identity-secrets-audit.mdx | skill | 7.3 | 76 | 3 | yes |
| 08-agent-fleets/01-parallel-agents.mdx | skill | 8.1 | 101 | 3 | yes |
| 08-agent-fleets/02-verification-review.mdx | skill | 8.2 | 91 | 3 | yes |
| 08-agent-fleets/03-unattended-operations.mdx | skill | 8.3 | 103 | 3 | yes |
| 08-agent-fleets/04-org-configuration.mdx | skill | 8.4 | 90 | 3 | yes |
| reference/api-reference.mdx | reference | — | 123 | 0 | yes |
| reference/building-blocks.mdx | reference | — | 102 | 3 | yes |
| reference/glossary.mdx | reference | — | 120 | 3 | yes |
