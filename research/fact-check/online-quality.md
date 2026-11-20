# Fact-check: 5.3 Online Quality Measurement
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
31 original citation claims checked: 25 supported, 6 fixed, 0 removed; 6 citations added; 1 Python code block checked and parsed successfully.
## Changes
- Opening definition — F1 was described as saying evals are “most useful” with production monitoring, broader than its quote → changed to say evals provide signals when combined with monitoring, A/B tests, and user research (F1).
- How online evaluation fits together — the F3 sentence blurred sampled failures with user-reported failures → made the recommendation match the source’s user-reported-failure scope (F3).
- Clio privacy section — the source page now identifies Clio as Anthropic Insights, and the chapter omitted the current name → added it and retained the note that this is a research example, not a customer API or protection promise (F9–F12, F32).
- A/B test sizing — the old F26 quote did not support the normal approximation; checked the sample-size arithmetic and the example’s confidence interval → updated F26 and corrected the interval to +0.91 to +5.10 percentage points (F26, F28).
- Experiment monitoring — the fixed-horizon claim was too broad outside continuous efficacy monitoring → narrowed it to that setting (F13, F14).
- Generation metrics — the judge guidance did not include the official sample-item rationale → added blinded human-label validation, pairwise order flipping, and top-line rechecks (F33, F34).
- Claude Code Analytics — corrected the Edit metric field path and separated the date, limit, and page claims so each has supporting quote text (F16, F29, F35, F36).
- Sampling and privacy — clarified probability sample on first use and added NIST support for residual re-identification risk (F37).
## Remaining concerns
- `verify-quotes.mjs` reports no not-found quotes, but its fetch step timed out for F26 and F37. I checked both exact quotes against the official pages with web fetch. All other quotes passed or passed the checker’s loose match.
