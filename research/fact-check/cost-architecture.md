# Fact-check: 6.1 Cost Architecture at Scale
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
43 citation claims checked: 27 supported, 15 fixed or narrowed, 1 removed. Citations added: 6. Code blocks checked: 1 (Python syntax passed). Final YAML has 42 citations; quote check found 27 exact and 15 loose matches, with no missing quotes.
## Changes
- Opening definition and cost framing — removed an unsupported quadratic-growth claim and “first and largest” ranking; tied the cache statistic to Anthropic’s production data and kept price comparison to listed models (F1, F21).
- Worked cost example — labeled pass rates as assumptions and tied estimates to cited list and cache rates; clarified the timestamp sensitivity as an example calculation (F1, F5, F7).
- TTL pricing and cache behavior — separated 5-minute and 1-hour write prices, removed unsupported break-even and cache invalidation details, and narrowed cache-order and automatic-caching explanations to cited behavior (F5, F11–F16, F46).
- Model routing — corrected the Haiku API ID, softened cascade guarantees, and removed unsupported Advisor overhead and retry claims (F23–F29).
- Batch economics — removed unsupported batch limits and parameter restrictions; retained the verified 50% discount, cache tradeoff recommendation, and workspace overshoot behavior (F18, F19, F44).
- Tenant budgets and analytics — removed the unverified Managed Agents session-budget claim; limited workspace, spend-cap, and analytics statements to verified behavior, including the five-dimension grouping limit (F31–F41).
- Citations — added six entries for analytics grouping, cache counting, workspace limits, spend-cap pause behavior, Batch API availability, and 1-hour cache pricing (F38–F41, F44, F46).
- Code — kept the sample explicitly labeled pseudocode and confirmed its Python block parses.
## Remaining concerns
- Citation quotes marked “loose” by the repository verifier matched its relaxed comparison; no quote was not-found or fetch-failed.
- The worked-example values are illustrative calculations, not Anthropic benchmarks.
