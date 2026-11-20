# Fact-check: Reference Practice Domain 3
Checked: 2026-11-19 · Reviewer: OpenAI GPT-6 (Codex)

## Summary
Reviewed 59 existing citation entries and their uses as claim units: 49 supported as used, 9 fixed or qualified, and 1 claim removed. Added 8 citations. Checked 10 answer keys and 0 code blocks; no Python parsing was applicable. The 10 items cover skills 3.1, 3.2, and 3.3.

## Changes
- Q1 privacy — Metadata-only spans can still contain user-selected text, and external retention is a separate boundary → added metadata review and qualified correlation (F1, F5, F10, F19).
- Q2 accounting — The reported inflation did not establish its causes → specified that the dashboard sums both span kinds and cache attributes; clarified billed API span counts (F3, F4, F8, F15).
- Q3 tracing — Checked TypeScript environment replacement, proxy propagation, exporter diagnostics, and sampled flag scope (F6, F11–F14, F23, F24).
- Q4 cache diagnostics — Comparing against a request that never opted in cannot work → enabled the first request, added the first-turn setup, and described inconclusive comparisons (F17, F18, F22, F62–F64).
- Q5 refusals — Sonnet 5 was outside the cited classifier-refusal model list → used Sonnet 5.5; distinguished completion from task success and acknowledged a compatible fallback (F28, F29, F35, F36, F65).
- Q6 spend and SLOs — Legacy report freshness is typical rather than guaranteed; the analytics watermark stabilizes reads rather than preventing later reconciliation → qualified both and separated estimated cost from token-based estimates (F25–F27, F30, F32, F66, F67).
- Q7 workspace attribution — The cited excerpt did not establish the Default Workspace null-ID assertion → removed that assertion and explained loss of isolation (F39).
- Q8 sampling — A fixed wait cannot guarantee all long-running spans arrive; dropped traces cannot be recovered downstream → qualified the wait and capacity guidance (F44–F46, F48–F51).
- Q9 cardinality — Attribute overflow can affect filtered results; it does not establish that every high-cardinality stream must overflow → qualified the explanation (F52–F56).
- Q10 attribution — Observational cohorts do not prove prompt causation → described the controlled comparison as a way to distinguish plausible causes (F57–F59).
- Coverage — Added definitions of SLI, SLO, grounding traceability, and reasoning traceability; distinguished source passages and reasoning summaries from verified outcomes (F60, F61). Added comparison across model versions to the monitoring decision (F35, F36).
- Editorial — Kept the frontmatter, SelfCheck format, 10 skill-tagged items, and original scenarios. Compared decision patterns with the three sample rationales summarized in the exam guide. No item reproduces those samples.

## Remaining concerns
- The practice questions use hypothetical measurements and operational assumptions; these illustrate decisions and are not observed production results. Source behavior, model availability, and telemetry schemas are version-sensitive.
- The quote verifier reports loose matches for some existing and new quotes; it reports no missing or failed fetches. Loose matching reflects formatting normalization, not independent validation of every broader claim in a citation entry.
