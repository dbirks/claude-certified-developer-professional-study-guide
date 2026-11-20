# Fact-check: Reference Api Reference
Checked: 2026-11-19 · Reviewer: OpenAI GPT-6

## Summary
The chapter contains 123 citation components and one Python code block. The focused review identified 8 claims or passages to fix, including 2 unsupported assertions removed; 4 citations were added. The code block was checked and parsed. The citation and quote checks passed. A complete sentence-by-sentence classification and reliable supported-claim count were not completed.

## Changes
- Platform request limits — the source establishes first-party 413 behavior but does not establish the same error on every partner platform → narrowed the 413 claim and added a first-party source (F3, F44).
- Message roles and metadata — “must alternate” conflicts with same-role message merging, and opaque IDs are recommended → corrected the wording (F7, F9).
- Image dimensions — the cited vision page does not establish a universal 8000 × 8000 pixel limit → removed that limit (F14, F15).
- Tool loop and example — the cause of most agent 400 errors was unsubstantiated; the example executes calls sequentially with simulated prices → removed the frequency claim and labeled the implementation and data (F19–F21, F42).
- Streaming — not every message delta necessarily contains all listed fields → describe top-level changes and cumulative usage (F32, F42).
- Structured output SDK transition — the dict exception has a specific SDK method scope → named the affected methods (F25).
- Stop handling and retries — a stop sequence need not be trimmed, a 504 is not limited to failures before response start, and a spend-cap 429 may persist → corrected actions and distinguished stream recovery (F35, F41, F42).
- Model and feature tables — the model table lacked a source and the broad GA row exceeded its citation → cited the model overview and retained the supported structured-output row (F25, F43).
- Exam lens — added decision patterns explicitly labeled as editorial inference; they distinguish refusals and length stops from transient failures (F41).

## Remaining concerns
- The official exam guide contains no separate “Reference Api Reference” skill or comma-separated objective. The packet's appendix outline supplies the coverage map; it is not an official exam objective.
- This review did not complete a claim-by-claim classification of all 123 citation components or a comprehensive verification of every table cell and uncited statement. Existing citation quotes can support only part of the surrounding sentence; passing the automated quote check establishes text matches, not full claim entailment.
- The SDK example was syntax-checked, not executed against the API. Its simulated prices are illustrative and depend on model tool calls.
