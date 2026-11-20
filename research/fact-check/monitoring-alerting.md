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
