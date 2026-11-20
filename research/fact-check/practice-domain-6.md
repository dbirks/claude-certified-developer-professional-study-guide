# Fact-check: Reference Practice Domain 6
Checked: 2026-11-19 · Reviewer: GPT-6

## Summary
38 original cited claims checked: 25 supported, 13 fixed, 0 removed. Five cited claims were added, along with 2 citations. Nine items reviewed independently; 0 fenced code blocks required parsing. Scenario numbers are illustrative assumptions, not measured service guarantees.

## Changes
- Q1 — Diagnostics needs prior opt-in, can be unavailable, and a miss does not itself prove a changed prefix → supply diagnostic evidence and qualify the result (F6, F11).
- Q1 — A longer TTL cannot repair an established prefix change; the original explanation assumed changes without evidence → specify consecutive divergence and distinguish TTL cost (F45).
- Q2 — A lower output limit does not necessarily truncate a response → describe the output limit accurately (F18).
- Q3 — A larger output limit does not guarantee that truncation disappears, and unchanged retries need not fail identically → describe the opportunity to finish (F18).
- Q3 — The low/high effort cascade was presented as universally cheaper and better → make it a measured candidate and compare success and cost (F17, F20).
- Q3 — Haiku retry failures were asserted without evidence → treat the unknown pass rate and retry cost as reasons to evaluate (F15, F16).
- Q4 — Post-response usage metering alone cannot enforce concurrent budgets → reserve conservatively, account for in-flight work, and reconcile delayed analytics (F19, F21, F22, F23).
- Q5 — Separate percentile measurements cannot be added as if they described the same request → use a representative trace and state that generation dominates the slow traces (F26, F27).
- Q5 — Model and effort changes do not guarantee lower task latency → make them evaluation candidates (F36, F37, F38, F39, F44).
- Q5 — Priority Tier's documented purpose does not establish an exclusive queueing mechanism → describe eligibility and lack of a latency guarantee (F40, F41).
- Q7 — The one-hour heuristic does not prove savings or immediate hits → qualify both claims and specify a changing timestamp (F6, F9, F14, F34).
- Q8 — Batch does not guarantee an interactive deadline; fast mode is not a repair for malformed tool input → clarify both tradeoffs (F12, F31, F39).
- Q8 — JSON validation alone cannot guarantee correct business effects → qualify the safety outcome (F30, F31).
- Q9 — Forecasting, cross-model cascades, and batch economics lacked direct coverage → add a numerical item and explain its assumptions and expiration risk (F12, F15, F16, F49).
- Opening — Define caching, breakpoints, TTFT, TTLT, and OTPS before use (F26, F34, F50).
- Skills 6.1 and 6.2 are both tagged and covered; no item restates the three official samples. No ExamLens component is present.

## Remaining concerns
- Real latency, cache reuse, cascade quality, and budget overshoot depend on workload, concurrency, platform, and billing; evaluate them in the target deployment. Local cancellation does not necessarily guarantee a remote request incurs no charge.
- The quote verifier reports 16 existing matches as loose matches; none are reported missing. They were not introduced in this review.
