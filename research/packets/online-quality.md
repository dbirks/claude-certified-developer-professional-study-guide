# 5.3 Online Quality Measurement

Analyzing quality on live production traffic using online evaluation techniques, including live-traffic sampling, A/B testing, feedback loops, and metric selection matched to task type (extraction, generation, agentic, retrieval-grounded).

## Scope map

- Live-traffic sampling → Core facts; Practitioner reasoning: Sampling and privacy.
- A/B testing → Practitioner reasoning: Experiments and rollout; Worked example.
- Feedback loops → Core facts; Practitioner reasoning: Feedback and drift.
- Metric selection matched to task type (extraction, generation, agentic, retrieval-grounded) → Practitioner reasoning: Task-specific metrics; Exact API / config details.

## Core facts

- Anthropic combines evals with production monitoring, A/B tests and user research for Claude Code; automated evals, production monitoring and periodic human review serve complementary purposes. (F1) (F2)
- User-reported failures can become evaluation tasks; ambiguous model-grading rubrics produce inconsistent judgments. (F3) (F4)
- Agent evaluation can combine code-based, model-based and human graders; static suites can track latency, token usage, cost per task and errors. (F5) (F6)
- Anthropic recommends multidimensional, application-relevant success criteria, and reliability testing before scaling LLM grading. (F7) (F8) (F22)
- Clio groups related conversations by theme, suppresses low-frequency topics with minimum thresholds and checks summaries for identifying information; its privacy safeguards are imperfect. (F9) (F10) (F11) (F12)
- Repeatedly using a fixed-horizon significance test while monitoring can inflate false positives; a suitable sequential method is an alternative. (F13) (F14)
- Claude Code analytics is daily, actor-level and may return multiple rows per actor; edit-tool proposals have accepted and rejected counts. Availability can lag by up to an hour. (F15) (F16) (F23) (F24)
- Sample-size planning depends on effect size, variation and power; interference between randomized units can bias effects. (F26) (F27) (F28)

## Exact API / config details

- Claude Code Admin API: `GET /v1/organizations/usage_report/claude_code`; required `starting_at` is a UTC date, `limit` is optional (default 20, max 1000), and `page` is the opaque `next_page` cursor. `tool_actions.edit_tool.accepted` and `.rejected` count decisions on Edit proposals. Aggregate an actor's dimension-split rows before computing a daily rate, not an unweighted average of row rates. The endpoint needs an Admin API key, `org:admin` OAuth token, or eligible unscoped personal/service key; workspace API keys do not work. (F15) (F16) (F17) (F23) (F29)
- For first-party Claude Messages, `usage.input_tokens` excludes cached input; record `cache_creation_input_tokens`, `cache_read_input_tokens`, `input_tokens`, and `output_tokens` separately, then apply the actual platform/model prices and tool charges. Total input processed is the sum of the three input categories. (F30) This avoids interpreting a cache mix change as a model improvement. (F18)
- Claude document citations can be enabled with `citations: {"enabled": true}` on a document block. Response text blocks can contain `citations`; location type and granularity depend on source type, and image-only PDF pages cannot be cited. Citation existence or `cited_text` alone does not prove entailment. (F19) (F20) (F21) (F31)
- The experiment assignment, evaluation record schema, sampling policy, and rubric below are application designs, not built-in Claude API parameters. No universal production sampling percentage, analytics endpoint for arbitrary app feedback, or platform-independent tariff is asserted.

## Practitioner reasoning

### Sampling and privacy

[INFERENCE] Define the population and sampling unit before collecting content: all eligible production tasks, one sample per task or sticky session, with a stable pseudonymous ID, assignment, timestamps, model/prompt/tool/retrieval versions and outcome. Choose a known-probability baseline sample separately from enriched samples of errors, rare languages or thumbs-down; record each inclusion probability and use inverse-probability weighting for population estimates. Report raw counts and uncertainty. Failure-only reviews find problems but cannot estimate the fleet failure rate. Preserve a separate untouched random sample for measuring releases.

[INFERENCE] Capture numeric outcomes and redacted metadata by default; collect minimum necessary text only under an authorized retention, access and deletion policy. Strip credentials, OAuth tokens, personal identifiers and sensitive tool results before storage or transfer to a grader, restrict reviewer access, audit access, encrypt and set short retention. Redaction can alter evaluation meaning: validate on permitted human-reviewed data and count suppressed/ungradable cases. Segment outputs need minimum cohort sizes and suppression of revealing intersections; do not claim simple pseudonymization, aggregation or a model-based redactor guarantees anonymity. Clio's layered design is an inspiration, not a customer-facing API or a promise of the same protections. (F9) (F10) (F11) (F12)

### Experiments and rollout

[INFERENCE] Fix the estimand, eligibility, randomization unit, primary outcome, denominator, baseline, minimum detectable effect (MDE), power, significance threshold, duration and guardrails before assignment. Assign using a stable keyed hash of an eligible user or tenant and experiment salt; persist assignments for the entire interaction. User-level assignment limits a user seeing inconsistent model behavior; use tenant-level randomization when shared state or collaboration creates interference, and power/analyze at that unit or with appropriate cluster-robust inference. Equal request counts are not independent user counts. Monitor sample-ratio mismatch, exposure logging, missing outcomes and changes in traffic mix. Analyze all eligible randomized units on an intention-to-treat basis; conditioning on a downstream event affected by the variant can bias results. (F27)

[INFERENCE] A shadow deployment mirrors permitted input and executes a candidate privately alongside the serving model; only the control's answer reaches the user. Record matched inputs, versioned retrieved context, output, latency, failures and cost; isolate credentials and block, simulate or replay write-capable MCP tools so neither branch duplicates external actions. Shadow quality can be judged on paired outputs, but has no direct evidence of user behavior, and replayed tool results can diverge from a candidate's actual sequence. Compare it with offline and live signals. Gradually expose a small stable randomized cohort, increase only after prespecified quality, safety, latency, error and cost guardrails pass, and keep a routing rollback to the prior model and configuration. Immediate mitigation of harm can interrupt an experiment; do not present an emergency stop as an ordinary fixed-horizon significance result. (F1) (F2) (F6)

[INFERENCE] Fixed-horizon significance requires the planned analysis time and sample size; repeated optional stopping inflates false alarms. If early efficacy decisions are needed, pre-specify a valid group-sequential/alpha-spending or anytime-valid method and its assumptions. Frequent operational monitoring for safety remains appropriate. A non-significant difference is not evidence of equivalence; predefine a noninferiority margin and appropriate test if seeking proof a cheaper model is not materially worse. Multiple primary metrics and subgroup searches need multiplicity control or explicit exploratory labeling. (F13) (F14) (F26)

### Task-specific metrics

[INFERENCE] Select observable outcomes before choosing a judge; track denominators and label quality. Combine deterministic checks with calibrated human/judge review and operational guardrails. (F5) (F7) (F8)

- **Extraction:** compare normalized typed fields against verified labels. Field exact match = correct fields / eligible fields; report per-field and record-level all-fields-correct separately. For multi-valued entities, precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2TP/(2TP+FP+FN). Define normalization, optional/null/missing fields, duplicates, micro versus macro aggregation and zero denominators in advance. Stratify high-impact fields; schema validity is not semantic correctness.
- **Generation:** score a versioned, behaviorally specific rubric for correctness, completeness, instruction adherence and tone with an independently calibrated model judge; use blinded human labels, randomized A/B answer order for pairwise scoring, and spot checks by segment. Exact text match penalizes valid alternatives. Track refusal and ungradable rates, judge/human disagreement, and cost per graded item. (F4) (F8)
- **Agentic:** task completion = verified successful tasks / eligible tasks, with timeout, cancellation and unsafe actions explicitly classified. Measure steps, tool calls, tool-error rate (failed calls / attempted calls), retries, elapsed time, total cost and human intervention. A shorter trajectory is useful only conditional on acceptable outcomes and safety; count duplicate side effects separately. Check final external state, not merely a model's self-reported success.
- **Retrieval-grounded:** groundedness = supported factual claims / assessable factual claims; citation precision = citation links that actually support their attached claim / citation links assessed. Define claim splitting, shared citations, partial support, contradictory evidence and zero-citation outputs. Also report citation coverage = factual claims with a supporting citation / factual claims requiring citations, answerability and retrieval hit/recall against human evidence labels. A valid citation location is not proof the cited passage entails the claim; score retrieval and synthesis separately. (F19) (F20) (F21)

### Feedback and drift

[INFERENCE] Treat thumbs-up/down, support reports, retries, edited answers, abandonment and accepted tool edits as noisy behavioral signals, not gold labels. Show explicit feedback rate (votes / eligible exposures) with vote mix (negative / votes); low or changing response rates and self-selection can reverse interpretations. Retries may reflect exploration, and edits can improve already useful text. Claude Code's Edit acceptance rate is accepted/(accepted+rejected), excluding unobserved proposals; pair it with task correctness and subsequent review rather than claiming accepted lines prove productivity. (F15) (F16)

[INFERENCE] Triage sampled negative signals, inspect permitted evidence, annotate failure origin (model, harness, tool, retrieval or user goal), prioritize impact, fix, add representative cases to regression tests, and validate online again; retain holdouts to reduce overfitting. Track weekly task mix, language, customer segment, input length, retrieval coverage and tool versions against a baseline; compare quality within stable strata as well as overall. A change in aggregate may come from mix shift rather than a within-segment regression. Monitor judge version and its agreement with a stable human-labeled set, calibration, latency, sampling probability and label delay; investigation should distinguish model drift, traffic drift, evaluator drift and instrumentation changes. Segment estimates need counts, confidence intervals and privacy suppression; rare groups often lack power. (F3) (F4) (F6)

## Worked example(s)

[INFERENCE] A support agent team evaluates hypothetical Claude configurations A and B. One eligible independent user starts exactly one task in a 50/50 fixed-horizon experiment; all assigned tasks, including failures and timeouts, are in the primary denominator. Completion is verified by a separately calibrated review process. Prior to launch: baseline 80%, MDE +3 percentage points (83%), two-sided alpha 0.05, power 80%, and no repeated efficacy peeking. Assume independent Bernoulli outcomes, stable rates, equal allocation, no interference, no missing labels, and no multiplicity correction. The following normal approximation for a two-sample proportion test gives **2,629 users per arm**. It is an approximation; simulation or a validated power tool should be used for the actual test, and clustered users, attrition or other constraints can increase the requirement. The 3-point MDE is a planning target, not a minimum guaranteed observed effect. (F26) (F28)

Runnable Python 3, standard library only; no SDK or version required:

```python
from math import ceil, sqrt
p_a, p_b = .80, .83
z_alpha, z_power = 1.95996398454, .84162123357
p_bar = (p_a + p_b) / 2
n = ((z_alpha * sqrt(2 * p_bar * (1 - p_bar))
      + z_power * sqrt(p_a * (1 - p_a) + p_b * (1 - p_b)))
     / (p_b - p_a)) ** 2
print(ceil(n))  # 2629 per arm, approximate
```

Suppose exactly 2,629 users per arm yield the following hypothetical results. Total cost includes all model, tool, retry and grading costs; time is user-perceived end-to-end time, not only model time.

| Metric | A | B |
|---|---:|---:|
| Verified completion | 2,103/2,629 = 80.0% | 2,182/2,629 = 83.0% |
| p95 latency | 6.0 s | 7.2 s |
| Mean cost / assigned task | $0.040 | $0.055 |
| Total cost / verified completion | $105.16/2,103 = $0.050 | $144.60/2,182 = $0.066 |

The observed difference is 3.0 percentage points; approximate unpooled 95% CI is +0.03 to +5.98 points, not a guarantee of the true effect. The extra 79 successful tasks cost $39.44, about $0.50 per additional success, in this illustrative cohort. If pre-registered p95 latency must be ≤7 seconds, B fails the guardrail despite its quality gain; retain A or optimize B and rerun. If the gate instead allows 8 seconds and the organization values the extra completions above their incremental cost, B can be considered for controlled expansion. Completion quality, segment outcomes and safety must still be checked. This is a superiority illustration, not a noninferiority analysis.

## Diagram spec

Flow: eligible traffic → sticky random assignment → A or B → user outcome and metrics → privacy-filtered probability sample → human/calibrated judge → experiment analysis → rollout gate or rollback; sampled failures → labeled regression suite → offline release gate. A separate shadow branch mirrors input through isolated candidate tools and feeds paired review. Caption: Combine prospective experiments and privacy-safe feedback with offline regression gates.

## Exam lens

- [Editorial inference] When a model wins offline but live completion falls, examine production traffic, missing slices and tool or retrieval context before declaring the offline suite conclusive.
- [Editorial inference] When repeated users share agent state, prefer stable user or tenant assignment and correctly clustered analysis over request-level randomization.
- [Editorial inference] A higher thumbs-up percentage among voters does not establish improved task success if participation differs; examine the exposure denominator and independent labels.
- [Editorial inference] Select evidence and metrics for the task: field correctness for extraction, calibrated rubrics for generation, outcome plus tool health for agents, and claim support plus citation precision for grounded answers.

## Common mistakes

- Treating failure-enriched sampling as representative traffic, or hiding ungraded observations in a denominator.
- Executing live mutations twice in shadow mode, or attributing the live-user effects of A to hidden B.
- Stopping the experiment at the first ordinary p < 0.05; treating lack of significance as proof of equivalence.
- Averaging per-segment rates without weights, treating clustered requests as independent users, or declaring an underpowered subgroup safe.
- Equating a citation with support, an accepted edit with correctness, or a completed API call with completed user work.
- Ignoring cache categories, tool charges, retries, grader expense, or tail latency when comparing cost and responsiveness.

## Self-check

1. A candidate has higher sampled thumbs-up but fewer users vote; what next? Compare exposure-normalized feedback, use randomized sampling and verified task outcomes, and inspect selection effects.
2. Why can shadow testing miss a regression in user retention? Users never interact with the shadow answer; only live randomized exposure measures that downstream behavior.
3. Why is one task success per API call a poor assumption for a multi-step agent? Many correlated calls belong to one user outcome; aggregate and analyze at the randomized unit while measuring tool errors separately.

## Unresolved

- No public source here establishes a universal correct sampling rate, privacy threshold, rollout percentage, MDE, or quality rubric; choose them for the product and its constraints.
- Numerical experiment results, cost figures and latency thresholds are fictional; no comparison of named Claude models or current prices is claimed.
- Power approximation does not cover clustered tenants, unequal allocation, missing outcomes, multiple tests or sequential monitoring; calculate for the actual design.
- The required quote checker could not fetch any cited URLs from the sandbox; web research fetched the pages separately, but the automated quote check remains unverified.
