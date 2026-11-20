# 3.3 Trace Analysis at Scale

> Analyzing high-volume trace data using sampling strategies, aggregation, and failure-cohort analysis to surface and quantify systemic issues that are not visible in individual traces.

## Scope map

- **Sampling strategies** → Core facts, Exact API / config details, and Practitioner reasoning: head, tail, stratified and rare-path retention; collector failure modes.
- **Aggregation** → Practitioner reasoning and Worked example: denominators, distributions, dimensions, baseline and time comparisons.
- **Failure-cohort analysis to surface and quantify systemic issues not visible in individual traces** → Practitioner reasoning, Worked example and Exam lens: cohort selection, outcome attribution, transcript review and next measurement.

## Core facts

- Head sampling decides early without seeing the entire trace. It is efficient but cannot guarantee retention of every trace containing an error. Tail sampling can consider all or most spans, so can retain traces according to later-observed properties. A head sampler can precede a tail sampler, but the latter only sees what survived the former. (F1, F2, F3, F4)
- The OTel Collector tail sampler buffers spans, requires all spans of a trace at the same collector, and can lose traces under capacity pressure; spans arriving after a decision can produce inconsistent decisions. (F5, F8, F9)
- Metric series multiply with distinct combinations of attributes. In an overflowed metric stream the total can remain correct even though filtering or grouping by original attributes undercounts. (F10, F11)
- Claude Code tracing is beta, explicitly enabled, and redacts prompt and tool content by default. Agent SDK shares the Claude Code runtime, whose OTel metrics and events can be exported when enabled. (F12, F13, F17)
- In Claude Code, `prompt.id` links the activity produced while handling one prompt. Tool-result events occur after execution and exclude rejected tool calls; look at decisions as well as results when studying the full funnel. (F14, F15)
- Claude API and Anthropic SDK OTel can trace Messages requests, tool use and Managed Agents sessions. A session can span multiple traces and threads, so a trace ID is not necessarily a session ID. Tool runner custom tool spans come from the SDK. (F18, F19, F29)
- A task outcome is the final state in the environment. Anthropic recommends reading transcripts and grades across trials to check graders; a plausible final response alone is not proof of task success. (F21, F22)
- Clio (renamed Anthropic Insights in the source's 2026 update) illustrates bottom-up discovery through abstract topic clusters and minimum user/conversation thresholds. Anthropic describes a cross-account pattern invisible at the individual-conversation level. This is an analogy for aggregate discovery, not a claim that Clio is a trace product or supplies a turnkey collector. (F23, F24, F25)

## Exact API / config details

- **Collector:** `tail_sampling` requires `policies`; its `status_code` policy supports `OK`, `ERROR`, `UNSET`. `decision_wait` defaults to `30s` in the cited current collector README; `num_traces` bounds buffered traces. The documented implementation offers `latency`, `string_attribute`, and `probabilistic` policies. Their exact policy configuration and defaults are version-dependent; pin the collector distribution and consult its README before deployment. Its latency policy measures earliest span start to latest span end, not a particular tool's execution. (F5, F6, F7, F8)
- **Capacity:** watch `otelcol_processor_tail_sampling_sampling_trace_dropped_too_early`, `otelcol_processor_tail_sampling_sampling_trace_removal_age`, and `otelcol_processor_tail_sampling_sampling_late_span_age`; set trace-ID-affine routing to the sampling tier and size wait and buffers for the observed workload. The first metric is a loss warning, not evidence of application failure. (F5, F8, F9)
- **Claude Code traces:** set `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`, and `OTEL_TRACES_EXPORTER` to an appropriate exporter. This is separate from enabling metrics/log exports. Content is redacted by default; do not enable capture merely to build cohort counts. (F12, F13, F17)
- **Events and joins:** `prompt.id` is a per-prompt correlation UUID, not a prompt-template version. Claude Code `claude_code.tool_result` includes `tool_name`, `success`, `duration_ms`, `error_type`, and `tool_use_id`; `claude_code.api_request` includes `model` and `duration_ms`. `tool_result` excludes rejected calls. Claude Code `claude_code.tool.execution` span `duration_ms` measures tool body execution; the encompassing tool span can include permission wait, so compare like with like. `event.sequence` is per process, not a globally ordered session sequence. Verify event availability and version in deployed runtime. (F14, F15, F16, F27, F28)
- **Claude API / SDK spans:** `gen_ai.request.model` identifies the requested model; tool spans use `gen_ai.tool.name`, `gen_ai.tool.call.id`, and `error.type`. Tool failure can appear as `tool_error`; MCP server names and session/thread IDs have source- and context-dependent availability. `gen_ai.conversation.id` identifies a Managed Agents thread and `anthropic.session.id` a session; neither should be assumed present for every Messages call. Distinguish requested and actual model when aliases or fallback are involved. (F18, F19, F20, F26, F29)
- **Application-defined fields:** `prompt_version`, tenant cohort, route template, task outcome and outcome provenance are example application schema fields, not claimed native Claude telemetry keys. Set and propagate them in your own instrumentation; define semantics consistently across deployments. Use an access-controlled warehouse for tenant-level analysis. (F11, F13)

## Practitioner reasoning

- [INFERENCE] Define the statistical unit first: one completed user task or attempt, with a stable task ID and one independently assessed terminal outcome. Track incomplete, timed-out, and ungraded attempts separately; silently excluding them can make failure rates look better. Join spans and events to the attempt without counting retries, tool calls, and model calls as separate tasks. Separate technical error from unmet user objective and record grading source/version.
- [INFERENCE] Use full-population counters or pre-sampling aggregates for task starts, completed outcomes and tool latency histograms when feasible. A 100%-error tail sample plus a 5%-success sample is excellent for investigation but its raw failure fraction is biased. If probabilities are known and nonzero, estimate counts using inverse inclusion probabilities and compute the ratio of weighted failures to weighted attempts; overlapping rules require the actual union inclusion probability, not the sum of policy percentages. Do not blindly use `1/p` for a rate-limited or adaptive policy whose realized per-trace probability is unknown. Prefer complete metrics for the denominator, and quantify uncertainty for sampled estimates.
- [INFERENCE] Reserve a known-probability baseline across all traffic, then oversample errors, slow traces, new routes/models, small tenants and rare tool paths. For known low-volume strata, assign a higher documented rate before or within sampling, within privacy and volume limits. Head-dropping 90% before a 100%-error tail policy retains at most the surviving errors; tail sampling cannot recover discarded traces. Any rare route discovered only after sampling needs an upstream signal or redesign. Keep sampling rate, policy version, and data-loss counters with the observation.
- [INFERENCE] For long-running agents, buffering all spans until a useful end condition competes with memory, decision latency and late arrivals. Estimate concurrent traces from arrival rate × decision wait, add burst headroom and account for spans/bytes per trace; validate with live collector metrics. A short wait may decide before a task fails, while a long wait increases state. Route by trace ID, monitor evictions and late spans, and revise wait/capacity or split long workflows with explicit task correlation. Treat “100% of failures” as conditional on arrival, timely decision and adequate capacity.
- [INFERENCE] Build a task-level table with time window, deployment, actual and requested model, application prompt version, tenant or approved tenant class, route template, tool/server, outcome, latency and sample probability. Group first by one dimension and then targeted combinations; compare counts and failure rates, failure contribution, latency p50/p95, and baseline. Report numerator, denominator, window, unknowns and confidence intervals. A cohort can have high relative risk but little total impact; a small increase on a high-volume route can dominate the incident. Check mix shifts (including Simpson's paradox) with standardized or matched comparisons.
- [INFERENCE] Exact tenant, task, user, session, prompt and trace identifiers are useful in restricted trace search but often unsuitable metric labels: label combinations explode and can contain sensitive data. Use bounded route templates, model families, prompt versions and approved tenant classes for dashboards; keep granular cohort analysis in a governed store. Monitor metric overflow and never assume an apparently healthy aggregate preserves each tenant's count. Suppress small public cohorts and protect any raw-content review; rare-path capture and privacy thresholds address different concerns and must both be designed.
- [INFERENCE] Compare `P(task failure | tool latency bucket, route, model, prompt, tenant class)` and tool error/timeout rates, plus task latency and retry counts. Align the tool call before the terminal failure, account for multiple calls per task and select a defined per-task statistic such as max or first relevant call. A slow tool may be a consequence of task difficulty, workload or retry storms, not the cause. Compare similar tasks and success traces; use rollout timing, controlled intervention or randomization to establish causality.
- [INFERENCE] Inspect representative transcripts from failing and successful cohorts, including tool arguments/results if policy permits. Check whether the agent adapted, whether the tool returned a meaningful result, whether a timeout or permission rejection occurred, and whether grading matched the actual external outcome. Convert confirmed failure patterns into held-out, reproducible regression evals; do not let the same samples both define and prove a fix.

## Worked example(s)

**Original synthetic example; no SDK or runnable code.** A production Claude agent handles OAuth-protected MCP document lookup. One attempt corresponds to one user task; outcome comes from a validated downstream completion check. Values and labels are invented and illustrate analysis, not product performance. The aggregate is complete pre-sampling task telemetry, and the five retained traces below are illustrative examples, not a representative sample.

| Trace | Model / prompt | Tenant / route | Lookup latency | Tool result | Task outcome |
|---|---|---|---:|---|---|
| T1 | M1 / v1 | A / search | 0.4 s | success | success |
| T2 | M1 / v2 | A / search | 4.8 s | timeout | failure |
| T3 | M1 / v2 | A / search | 5.1 s | timeout | failure |
| T4 | M1 / v2 | B / search | 0.5 s | success | success |
| T5 | M1 / v2 | A / search | 4.6 s | success after retry | success |

The five examples suggest an association and show a successful recovery, but their raw 2/5 failure rate says nothing about the population. In the same one-hour window, the complete task-level aggregation is:

| Cohort (all M1, search, lookup) | Attempts | Failures | Failure rate | Lookup ≥4 s | Failures among ≥4 s | Failures among <4 s |
|---|---:|---:|---:|---:|---:|---:|
| Tenant A, v1 | 1,000 | 20 | 2% | 50 | 10 / 50 (20%) | 10 / 950 (1.05%) |
| Tenant A, v2 | 1,000 | 100 | 10% | 200 | 80 / 200 (40%) | 20 / 800 (2.5%) |
| Tenant B, v2 | 1,000 | 20 | 2% | 50 | 10 / 50 (20%) | 10 / 950 (1.05%) |
| Total | 3,000 | 140 | 4.67% | 300 | 100 / 300 (33.3%) | 40 / 2,700 (1.48%) |

[INFERENCE] Tenant A/v2 has an 8 percentage-point absolute increase and 5× the failure rate of A/v1; it contributes 100/140 (71.4%) of observed failures. Slow calls are associated with more failures, and A/v2 has both more slow calls and a higher slow-bucket failure rate. The table alone does not establish whether the prompt change, an OAuth refresh, MCP service capacity, tenant task mix, or some other simultaneous change caused the regression. Individual T2 or T3 can show a timeout but cannot establish its excess frequency or impact.

**Next measurement:** [INFERENCE] During a controlled v1/v2 split within tenant A, record one row per attempt with assignment, task type, OAuth refresh/401 and retry timing, lookup latency, deadline, timeout reason, and externally verified final outcome. Compare failure and latency rates by assigned version and task type with counts and confidence intervals; examine sampled success and failure transcripts, including T5-like recoveries. Ensure both variants receive similar traffic and account for in-flight tasks and data loss. If randomization is unavailable, compare matched time windows and workload mix, treating results as observational. A measured fall in failures after a controlled change, with no offsetting regressions, is stronger evidence than the initial correlation.

## Diagram spec

Type: flow. Nodes: instrumented agent and MCP service → full-population outcome/latency aggregates; same instrumented services → trace-ID-affine collector → tail policies (baseline, failure, slow, rare path) → restricted trace store; both stores → cohort comparison → representative transcript review → hypothesis → controlled measurement and regression eval. Caption: Preserve population denominators while retaining targeted traces to explain cohort-level changes.

## Exam lens

- **Editorial inference:** A scenario with many healthy traces and rare costly failures favors explicit rare/failure coverage plus a known-probability baseline over naive uniform-only sampling.
- **Editorial inference:** A scenario with trace loss or split traces asks for trace-affine routing, buffer/wait tuning and collector health before concluding the application improved.
- **Editorial inference:** A scenario with a changed global failure rate asks for task-based denominators and segmentation by model, prompt, tenant, route and tool before causal attribution.
- **Editorial inference:** A scenario with high-cardinality identifiers and sensitive transcripts asks for bounded metrics, governed detailed review and a privacy-aware sampling policy.

## Common mistakes

- Using the fraction of failures in an oversampled trace store as the production failure rate, or pretending head-dropped failures can be recovered downstream.
- Counting requests, retries, or tool calls as independent completed user tasks; treating tool `ERROR` as automatically equivalent to task failure.
- Comparing latency from different span boundaries, ignoring permission wait or multiple tool calls, and claiming causality from correlation.
- Dropping rejected tool decisions, missing late spans, or ignoring collector loss while claiming full failure coverage.
- Putting unbounded IDs into every metric label, overlooking overflow, or assuming a suppressed small group has no failures.

## Self-check

1. A 10% head sampler feeds a tail policy that keeps all errors. What fraction of errors reaches the tail policy? **Answer:** In expectation about 10%, assuming independent uniform head sampling; downstream cannot recover the other errors.
2. A cohort's sampled traces show 100 failures and 100 successes, with known inclusion probabilities 1 and 0.1. Estimated failure rate? **Answer:** 100 / (100 + 100 / 0.1) ≈ 9.1%; uncertainty and any other sampling/drop mechanisms still matter.
3. Why inspect both successful and failed slow-tool traces? **Answer:** To find whether latency preceded failure, how recovery differs, and whether the apparent pattern or grader is misleading.

## Unresolved

- The quote verifier could not fetch any citation URL from the execution environment; web research accessed the pages, but automated quote verification remains outstanding.
- Collector settings and Claude telemetry schemas change; the linked collector README is an evolving main branch, so validate against the deployed version. No universal native Claude field for application prompt version, tenant, route, or ground-truth task outcome was verified; supply these explicitly.
- Sampling and aggregation safeguards cannot be assumed to provide a formal privacy guarantee merely because they resemble Clio's design. No Clio algorithm or privacy threshold is specified here for direct reuse.
