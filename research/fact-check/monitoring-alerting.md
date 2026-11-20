# Fact-check: 3.2 Production Monitoring and Alerting
Checked: 2026-11-19 · Reviewer: OpenAI GPT-6

## Summary
Checked 33 original citation entries as claim groups: 24 supported, 9 required scope or wording fixes. Removed one unverified SDK example; added 2 citations. Checked 2 original Python blocks; retained and parsed 1. Counts group repeated uses of the same source claim rather than counting each citation occurrence.

## Changes
- SLI and burn-rate definitions — error budget was named without definition → define permitted failures and burn rate (F1, F3).
- Multi-window alerting — the one-twelfth ratio was presented as universal, although the three-day example uses six hours → state it as a guideline (F4, F5).
- Worked alert timeline — a 1.8% failure rate cannot cross the one-hour 1.44% threshold in 15 minutes from a clean baseline → correct detection and rollback times and state traffic assumptions (F4, F5).
- Latency telemetry — a per-request span duration was presented as a full turn → use the Claude Code interaction duration for the turn (F20).
- Response classification — all non-end-turn stops and all listed successful stops were treated as errors or refusals → distinguish intermediate tool use, unhandled truncation, and actual refusal events (F11, F19).
- Analytics watermark — pinning the cutoff was presented as preventing revisions → explain that reconciliation can revise earlier data; remove the unverified SDK example (F14, F15).
- Spend and ramp alerts — retries were described as ineffective for all limit types and cap recovery as necessarily waiting for month-end → follow ramp retry guidance and allow tier increases (F30, F31).
- Workspace spend — grouping cost by API key was asserted without establishing the source and dimensional support → recommend workspace attribution and application correlation (F16, F32).
- Cache and drift diagnosis — symptoms were asserted to prove cache invalidation or infrastructure change; cache reads were called unbilled → describe competing causes, discounted cache-read billing, and the opt-in sequence for diagnostics (F23, F24, F27, F28, F34, F35).
- Dashboard coverage — objective lacked an explicit dashboard design → add panels, breakdowns, baselines, denominators, release markers, and freshness.
- Safety refusal target — a low refusal rate can reward unsafe behavior → replace the numerical ceiling with investigation against a baseline (F12).
- Exam lens and recovery — deterministic incident diagnoses and universal failure classification → frame as investigation and decision patterns (F11, F23, F27, F28).

## Remaining concerns
- Beta API fields, model availability, pricing and limits can change after this review; recheck before implementation.
- The Python alert example assumes error ratios are already computed; production implementations must define request eligibility, missing data, and alert evaluation behavior.

## Second pass (OpenAI GPT-6)

Checked: 2026-11-19 · Reviewer: OpenAI GPT-6

### Summary

Reviewed 35 existing citation entries as claim groups and their uses throughout the chapter: 25 supported and 10 needed scope, attribution, or decision-context fixes; 0 claim groups removed. Added 3 citations. Checked 1 Python block and parsed it successfully. Counts describe citation claim groups, not individual sentences; multiple uses can share a group.

### Changes

- Burn-rate guidance — starting thresholds read as universal and the worked example omitted the possibility of an earlier 6x page → qualify the recommendations and isolate the illustrated rule (F4, F5).
- Low-volume monitoring — “breaks every ratio” overstated the issue and synthetic traffic could mask real-user failures → describe noisy ratios and keep probe and user results separate (F6, F38).
- TTFT — “primary” overstated the source and the table assigned request TTFT to the interaction span → use a qualified responsiveness measure and name the correct span (F7, F20).
- Streaming stop reasons — initial and final stream events were not distinguished → add the `message_delta` collection point (F11, F36).
- Tool failures — the denominator implicitly included rejected calls, which do not emit tool-result events → use completed executions and track decisions separately (F19, F37).
- Claude Code spans — version requirements for `first_content_ms` and `error_class` were not stated → state the v2.1.268 minimum (F20).
- `pass^k` — trial consistency was equated with what all production traffic sees → qualify the production inference (F25).
- Tier spend cap — explanation omitted the possibility of raising the limit → include that recovery path (F30).
- Model lifecycle and pinned models — retirement ordering and infrastructure effects were presented too deterministically → describe lifecycle stages and possible behavioral effects (F28, F29).
- Quality drift and exam lens — monitoring listed signals without enough investigative decisions, and the lens did not explicitly identify its editorial status → add cohort comparisons, human judge calibration, canary comparison and rollback, and an inference label (F26).
- Verification — reviewed the original citation quotes and opened official sources for details beyond quoted spans; checked the objective and the three sample-item rationales. Citation checker passed. Quote verification used an isolated copy because the script otherwise writes outside the three permitted files; all 38 quotes matched. The scoped Astro build completed.

### Remaining concerns

- Telemetry fields, beta APIs, model availability and spend policies can change. The Analytics watermark limits the cutoff but does not prevent later reconciliation.
- The alert example assumes precomputed ratios and steady request volume; production rules need explicit handling for missing data and eligible requests.
