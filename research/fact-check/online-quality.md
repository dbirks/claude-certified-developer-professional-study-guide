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

## Second pass (GPT-6)

Checked: 2026-11-19 · Reviewer: GPT-6

53 cited passages checked: 44 supported, 9 fixed, 0 removed; 4 citations added; 1 Python code block checked and parsed. Counts refer to citation-bearing passages in the edited chapter, including repeated citations; fixes group related wording changes.

### Changes

- Production monitoring — F2's shorthand “ground truth” could imply that monitoring supplies quality labels; the same source says monitoring lacks ground truth for grading → describe observed behavior (F2).
- Sampling — known selection probabilities alone do not correct selectively missing labels → state the nonresponse limitation and require nonzero inclusion probabilities.
- Experiment design — interference and repeated peeks do not inevitably produce bias or inflate error → use conditional wording; define estimand, MDE, and power (F13, F27).
- Sample size — F26 describes a one-sample proportions derivation, not the example's two-sample formula → identify its scope; independently parsed and ran the example (F26).
- Analytics endpoint — the date quote did not document the endpoint or actor-level aggregation → cite the endpoint and actor data separately (F38, F39).
- Document citations — the prior wording implied every enabled response has multiple cited blocks, and F19 did not establish location formats → use the documentation's conditional wording and cite document-dependent formats (F19, F40, F41).
- Privacy and drift — citations were attached to adjacent recommendations rather than the claims they support → place them directly after the re-identification and rubric claims (F4, F37).
- Feedback and clustered observations — correct the acceptance-rate sentence, preserve both exposure rate and vote mix, and replace the claim that request-level counting necessarily biases an estimate with the uncertainty and weighting risks (F16).
- Exam lens — remove citations that did not support the task-metric recommendations; preserve the calibration and deterministic-control decision patterns in the official sample-item rationales.

### Remaining concerns

- Direct shell fetches are network-restricted. Quote verification passed using the existing local cache (32 exact, 9 loose, 0 not found); official pages were also opened through web fetch. The checker and build ran in an isolated copy to avoid changing unauthorized generated files.
