# Fact-check: Reference Practice Domain 2
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
76 cited claims checked: 74 supported, 2 corrected for scope or reasoning; 0 removed. Citations added: 3. Code blocks checked: 0 (none present).
## Changes
- Q3 retry rationale — applied a general retry-amplification example to a nested SDK-plus-outer-loop setup → removed the unsupported 3x-to-1.1x arithmetic; separated spend-cap, refusal, transient-overload, and context-window handling (F13, F14, F16, F74).
- Q11 citation configuration — conflated consistency rules for document blocks and search-result blocks → specified that each block type has its own consistency rule, and revised the scenario to show mixed settings among search results (F65–F68).
- Q4 cache explanation — timestamp/cache-prefix behavior lacked a direct source → cited the cache-prefix matching rule (F75).
- Q6 batch scenario — 50% discount lacked a citation → added an official pricing citation (F76).
- Q1, Q3, Q10 — added concise explanations for circuit breakers, backpressure, and tuning chunking/embeddings against labeled retrieval queries.
- Coverage and item review — added context-window stop handling; independently checked the answer keys and preserved the 12-item SelfCheck format, frontmatter, and skill tags. The set covers Skills 2.1–2.4.
## Remaining concerns
- Rate limits, model IDs, beta headers, and platform support can change; verify them against the linked official docs before production use.
