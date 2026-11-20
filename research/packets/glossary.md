# APPENDIX Glossary and operational formulas

## Scope outline

- **Operational terms:** service objectives and telemetry; Messages API and agent execution; caching, tokens, price, and latency; reliability, evaluation, statistics, and queueing.
- **Operational formulas:** SLI/SLO/error budget/burn rate; percentiles; TTFT and output throughput; cache metrics and effective input cost; task economics and retries; pass@k/pass^k; retrieval/classification metrics; agreement and power; Little's law.

## Core facts

### Glossary (80 terms)

#### Service health and telemetry

1. **Availability SLI** — Fraction of in-scope requests meeting the service's success definition; define which caller-visible outcomes count as good before calculating it. A request-based SLI can count successful requests. (F2, F21)
2. **Latency SLI** — Fraction of requests returning within a stated threshold, or a distribution of request durations; state whether the target applies to requests or time windows. (F21)
3. **SLI (service-level indicator)** — A measured signal of customer-relevant service behavior, such as successful-request ratio, time-to-first-token, or bounded-latency ratio. (F1, F21)
4. **SLO (service-level objective)** — A desired SLI performance goal over an evaluation period, for example 99.9% of eligible requests succeed over 30 days. (F1)
5. **SLA (service-level agreement)** — A customer or provider commitment with defined remedies or consequences; it is a contract, while an SLO is an engineering target. The precise legal meaning depends on the agreement. [INFERENCE]
6. **Error budget** — Allowed bad-event fraction in the SLO window; a 99.9% availability objective allows 0.1% bad events. (F3, F4)
7. **Burn rate** — Observed bad-event ratio divided by the SLO's allowed bad-event ratio; 1x spends the budget evenly over its window, 10x spends it ten times faster. (F3, F4)
8. **Rolling window** — A time interval that continuously advances, unlike a calendar-aligned reporting interval. [INFERENCE]
9. **Request-based SLI** — An SLI whose atomic denominator is requests, typically good requests divided by eligible total requests. (F2)
10. **Window-based SLI** — An SLI whose units are qualifying time windows; an interval can be marked good when a percentile or threshold condition is met. (F1)
11. **Good event / bad event** — An event classified as satisfying or violating an SLI contract. For Claude-backed tasks, decide how refusals, tool failures, cancellations, and invalid requests enter the denominator. [INFERENCE]
12. **Golden signal** — A summary signal such as latency, traffic, errors, or saturation; pair it with task quality and token cost for Claude applications. [INFERENCE]
13. **Metric** — A runtime measurement that can be aggregated across events; use a histogram for latency distributions rather than retaining only an average. (F22, F34)
14. **Counter** — A monotonically accumulating measurement, suitable for requests, errors, token counts, and successful tasks. [INFERENCE]
15. **Gauge** — A point-in-time measurement such as active queue depth or in-flight calls; it may rise and fall. [INFERENCE]
16. **Histogram** — A metric instrument for recording values such as request duration so a backend can derive distribution summaries and percentiles. (F22)
17. **Trace** — A linked view of a request's path through components; for agents, include model turns, tools, retrieval, retries, and downstream work. [INFERENCE]
18. **Span** — A timed parent-child segment in a trace, such as one Claude Messages call or tool invocation. [INFERENCE]
19. **Structured log** — An event record with stable machine-readable fields such as request ID, model, stop reason, token usage, and outcome. [INFERENCE]
20. **Cardinality** — Number of distinct time-series label combinations; avoid unbounded labels such as full prompt text, user IDs, or tool arguments. [INFERENCE]

#### Messages API and agent execution

21. **Messages API** — Claude's direct model prompting API; an application orchestrates a custom agent loop when needed. (F19)
22. **Stateless conversation** — Messages API requests include the history needed for the current turn; prior turns are not implicit server-side conversation state. (F19)
23. **Assistant turn** — A model response cycle that may contain text, tool calls, or a stop condition, rather than necessarily a complete user-facing task. [INFERENCE]
24. **stop_reason** — Response field identifying why Claude stopped; distinguish completed text, output truncation, tool handoff, refusal, and other stops. (F17, F18)
25. **end_turn** — Claude completed its response naturally. (F18)
26. **max_tokens stop** — The response reached its output-token limit; treat it as potentially truncated and continue or adjust the budget as appropriate. [INFERENCE] (F17)
27. **tool_use stop** — Claude is handing control to a tool call; execute the tool and return the result before expecting a completed model turn. [INFERENCE] (F17)
28. **stop_sequence** — A configured stop string ended generation; inspect the stop sequence to identify which value fired. [INFERENCE]
29. **pause_turn** — A server-tool loop reached its iteration limit; Anthropic documents sending assistant content back to continue. [INFERENCE] (F17)
30. **refusal** — A safety refusal stop reason; do not treat it as a transient transport failure or blindly retry unchanged content. [INFERENCE] (F17)
31. **Context-window stop** — model_context_window_exceeded means the response filled the model's context window and should be treated as truncated. [INFERENCE] (F17)
32. **Streaming** — Messages API responses can arrive incrementally as server-sent events, so text can be consumed before the full response arrives. (F9)
33. **message_start** — Initial stream event containing a Message object; its usage snapshot may precede completion and is not final usage. [INFERENCE] (F9, F10)
34. **message_delta** — Stream event carrying response changes and usage; Anthropic documents those usage counts as cumulative. (F10)
35. **Tool round-trip** — Model tool-use request, application execution, tool-result submission, and subsequent model response; attribute time and cost across the sequence. [INFERENCE]
36. **Agent loop** — Application-controlled repetition of model calls, tools, and state updates until a stop condition or task policy ends work. [INFERENCE]
37. **Orchestration overhead** — Latency, tokens, and infrastructure consumed by routing, tools, retries, and control logic beyond a single generation. [INFERENCE]

#### Tokens, caching, price, and latency

38. **Input tokens** — Claude usage input_tokens represents uncached input after the last cache breakpoint, not the full logical prompt. (F11, F12)
39. **Output tokens** — Tokens generated in a response and reported in final Message usage; use final usage when computing throughput. (F10)
40. **Cache creation tokens** — cache_creation_input_tokens counts tokens written to a cache entry. (F13)
41. **Cache read tokens** — cache_read_input_tokens counts tokens retrieved from cache; it is a volume, not a count of requests that hit. [INFERENCE] (F11, F13)
42. **Prompt caching** — Reuses previously processed prompt portions across Claude API calls; cache eligibility follows the breakpoint and cache rules. [INFERENCE] (F20, F35)
43. **Cache breakpoint** — Position delimiting a reusable prefix; input after the last breakpoint is counted in input_tokens. (F12)
44. **Cache TTL** — Lifetime of a cached prefix. Default TTL and minimum lengths are model/platform-sensitive details to check in current docs. (F15, F35)
45. **Cache hit (token-level)** — A request with cache_read_input_tokens above zero; this does not mean every cacheable token hit. [INFERENCE] (F13)
46. **Cache hit rate (request-level)** — Requests with a nonzero cache read divided by cache-eligible requests; exclude initial writes and requests without reusable prefixes. This is an application-defined ratio, not a direct Anthropic usage field. [INFERENCE]
47. **Cache read share** — Cache-read input tokens divided by total input tokens processed; a volume metric, not request-level hit rate. (F11)
48. **Effective input cost** — Input-token charge after splitting ordinary input, cache writes, and cache reads and applying model/platform rates and multipliers. [INFERENCE] (F14-F16)
49. **Token price unit** — Prices may be quoted per million tokens; divide token counts by 1,000,000 before multiplying by the rate. [INFERENCE]
50. **TTFT (time to first token)** — Time from prompt submission until the model generates its first response token, useful for perceived responsiveness with streaming. (F7)
51. **Time to first byte (TTFB)** — Time until the first response byte reaches the client; includes transport/proxy effects and differs from model TTFT. [INFERENCE]
52. **Generation duration** — Time from first generated token until final generated token; isolate it from TTFT when measuring generation rate. [INFERENCE]
53. **Output tokens per second** — Completed output-token count divided by generation duration; specify model-side versus client-observed timing and excluded tool/queue delays. [INFERENCE]
54. **End-to-end latency** — Time from accepted task/request to application-defined completion; for agents this can include queues, tools, retries, and model calls. [INFERENCE]
55. **p50 / median latency** — 50th percentile: half the observations are at or below the estimate, subject to the quantile method. (F5, F6)
56. **p95 latency** — Estimated 95th percentile; roughly 5% of observations are above it, with finite-sample method affecting the estimate. (F5, F6)
57. **p99 latency** — Estimated 99th percentile; useful for tail behavior but noisier than central percentiles at small sample sizes. (F5, F6)
58. **Tail latency** — Slow-end behavior of a latency distribution, often assessed with p95/p99 rather than the mean. [INFERENCE]
59. **Cost per request** — Total metered cost divided by request count; it can hide multi-turn work, failure, retries, and unequal task complexity. [INFERENCE]
60. **Cost per successful task** — Total cost for all attempts and overhead divided by tasks meeting the success criterion; aligns spend with delivered work. [INFERENCE]

#### Reliability, evaluation, statistics, and queueing

61. **Retry** — Repeating an operation after failure; cap attempts and use backoff with jitter to avoid synchronized retry amplification. (F29, F30)
62. **Retry amplification** — Total provider attempts divided by original logical operations; 1.4x means 40% extra calls from retries or duplicate attempts. [INFERENCE]
63. **Retry budget** — Cap on retry attempts or retry traffic per request or time window, preventing retries from overwhelming normal work. [INFERENCE]
64. **Pass@k** — Probability or benchmark estimate that at least one of k generated samples passes the verifier; measures multi-sample capability when selection is possible. (F33)
65. **Pass^k** — Probability all k independent executions of a task succeed, averaged across tasks; measures repeated-run consistency. (F31, F32)
66. **Precision** — True positives divided by all positive predictions; in retrieval, relevant items among those returned. (F23)
67. **Recall** — True positives divided by all actual relevant items; in retrieval, share of relevant items retrieved. (F23)
68. **F1** — Harmonic mean of precision and recall with equal relative contribution; not a replacement for asymmetric task error costs. (F24)
69. **Recall@k** — Relevant items in the first k results divided by all known relevant items for the query; measures coverage at a fixed context budget. [INFERENCE]
70. **Cohen's kappa** — Two-rater categorical agreement adjusted for chance: κ = (Po − Pe)/(1 − Pe). (F25)
71. **Observed agreement (Po)** — Fraction of examples where two raters choose the same category. [INFERENCE] (F25)
72. **Expected agreement (Pe)** — Agreement predicted from each rater's marginal label frequencies under independence. [INFERENCE] (F25)
73. **Statistical power** — Probability a test rejects its null under a specified alternative and design; conventional notation is 1 − β. [INFERENCE] (F26, F27)
74. **Minimum detectable effect (MDE)** — Smallest effect a planned test can distinguish from the null at selected significance and power, given variance and sample size. (F26, F27)
75. **Type I / Type II error** — Type I is a false positive under a true null (α); Type II misses an effect under an alternative (β), whose complement is power. [INFERENCE] (F26)
76. **Arrival rate (λ)** — Mean number of tasks entering a queue per unit time; distinguish offered arrival rate from accepted/completed throughput. [INFERENCE] (F28)
77. **In-flight work (L)** — Mean items inside the measured system boundary, including queued and executing work if both are in scope. [INFERENCE] (F28)
78. **Residence time (W)** — Mean time an item spends inside the system boundary, including queue wait plus service time when both are in scope. [INFERENCE] (F28)
79. **Little's law** — In steady state, average in-system work equals mean arrival rate multiplied by mean time in the system. (F28)
80. **Backpressure** — Control that slows, rejects, or queues incoming work when downstream capacity is constrained; bound queue growth and signal overload. [INFERENCE]

### Operational formulas

Equations state units and denominators. Derived metrics are operational definitions; all rates are illustrative.

- **Request success SLI:** good requests / eligible total requests. Example: 9,980 / 10,000 = **99.8%**. (F2)
- **SLO compliance:** measured SLI >= target over the declared window. Example: measured 99.8% against a 99.9% 30-day objective is below target for that window. (F1)
- **Error budget:** 1 − SLO for a ratio SLO. Example: 99.9% gives 1 − .999 = **0.1%**; with 10,000 equally weighted eligible requests, budget is 10 bad events. (F3, F4)
- **Burn rate:** observed bad-event ratio / allowed bad-event ratio. Example: 1% bad requests / 0.1% allowed = **10x** burn. (F3, F4)
- **p50 / p95 / p99:** sort request durations and take the stated quantile. Example sorted samples [100, 120, 150, 180, 220] ms yield p50 = **150 ms**; exact p95/p99 estimates depend on quantile interpolation, and five points are inadequate for stable tail estimates. (F5, F6)
- **TTFT:** timestamp(first generated token) − timestamp(prompt submitted). Example: prompt at 12:00:00.000 and first visible token at 12:00:00.420 gives **420 ms**. (F7)
- **Output tokens/second:** final output_tokens / (time of final token − time of first token). Example: 240 tokens over 8 seconds after first token = **30 tokens/s**; report TTFT separately. (F7, F10)
- **Cache read share:** cache_read_input_tokens / (cache_read_input_tokens + cache_creation_input_tokens + input_tokens). Example: 8,000 read + 2,000 write + 1,000 uncached = 8,000/11,000 = **72.7%** read share. This is not request hit rate. (F11, F12)
- **Request cache hit rate (defined here):** requests with cache_read_input_tokens > 0 / cache-eligible requests. Example: 720 read-hit requests / 900 eligible repeats = **80%**. Exclude first writes and requests with no reusable prefix. [INFERENCE] (F13)
- **Effective input cost:** [(uncached input × base rate) + (cache-write tokens × base rate × write multiplier) + (cache-read tokens × base rate × read multiplier)] / 1,000,000. Example at illustrative $3/MTok: 1,000 uncached tokens, 2,000 five-minute write tokens at 1.25x, 8,000 read tokens at 0.1x cost (3,000 + 7,500 + 2,400)/1,000,000 = **$0.0129**. Use actual model/platform rates and modifiers. (F11, F14-F16)
- **Cost per successful task:** total cost for all attempts / successful tasks. Example: $120 spent / 800 successful tasks = **$0.15 per success**. Failed attempts and retries remain in the numerator. [INFERENCE] (F20)
- **Retry amplification:** provider attempts / original logical operations. Example: 1,400 attempts / 1,000 operations = **1.4x**, or 40% extra attempts. Separate SDK retries from application retries when diagnosing. [INFERENCE] (F29, F30)
- **Pass@k, fixed independent success probability:** 1 − (1 − p)^k, where p is one-attempt pass probability. Example p=.8, k=3 gives 1 − .2^3 = **99.2%** chance that at least one succeeds. Benchmark estimators may differ from this plug-in formula. (F33)
- **Pass^k, independent reliability:** p^k; with n observed trials and c passes on one task, the unbiased combination estimate is C(c,k)/C(n,k), or zero if c < k. Example p=.8, k=3 gives .8^3 = **51.2%** all-three success. (F31, F32)
- **Precision / recall / F1:** P=TP/(TP+FP), R=TP/(TP+FN), F1=2PR/(P+R). Example TP=8, FP=2, FN=4 gives P=.80, R=.667, F1=.727. (F23, F24)
- **Recall@k:** relevant retrieved in top k / all known relevant. Example 3 of 5 relevant passages occur among the first 10 = **Recall@10 .60**. Choose the unit that enters Claude's context (document, chunk, or evidence span). [INFERENCE]
- **Cohen's κ:** (Po − Pe)/(1 − Pe). Example observed agreement Po=.90 and chance-expected Pe=.60 gives (.90−.60)/(1−.60) = **.75**. Report prevalence and raw agreement too. (F25)
- **Power / MDE:** power = P(reject H0 | specified alternative) = 1 − β; MDE = smallest effect δ for which planned power(δ; n, variance, α) reaches target power. Example: at α=.05 and target power .80, a design calculator could report **+5 percentage points** as MDE for its specified sample size and baseline variance. That threshold is design-dependent, not universal. (F26, F27)
- **Little's law:** L = λW. Example: 40 accepted tasks/second with average in-system time 2 seconds implies **80 tasks** in the system on average. Use steady-state averages, consistent boundaries, and matching time units. (F28)

## Exact API / config details

- Final Messages API responses expose usage.input_tokens and usage.output_tokens; under caching, total input adds cache_creation_input_tokens and cache_read_input_tokens. Do not use input_tokens alone as total prompt input. (F11, F12, F19)
- Cache fields are present in final response usage or streaming message_start usage. message_delta usage counts are cumulative; do not sum snapshots as if they were deltas. (F9, F10, F13)
- Documented stop_reason values include end_turn, max_tokens, stop_sequence, tool_use, pause_turn, refusal, and model_context_window_exceeded. Route them distinctly. (F17, F18)
- Prompt-cache minimum lengths and read multipliers vary by model and can change; consult the current prompt caching and pricing pages before setting thresholds or forecasting. (F14, F15, F35)
- Current API error docs say the official SDK retries transient errors twice by default with exponential backoff, honoring retry-after where present. Instrument SDK and application retries separately. This behavior may change by SDK version. (F30)
- OpenTelemetry histograms support aggregating latency observations and percentile summaries; standardize units, windows, and aggregation method across services. (F22, F34)

## Practitioner reasoning

- [INFERENCE] Define task completion before setting an SLI: HTTP success may still be a refusal, incomplete answer, failed tool sequence, or incorrect extraction. Separate infrastructure and task success.
- [INFERENCE] Track TTFT and end-to-end tail latency separately; streaming can improve perceived response while tools or generation still violate completion objectives.
- [INFERENCE] Use cache read share for cost composition and request-level hit rate for cache behavior. Measure only eligible repeats.
- [INFERENCE] Specify experiment metric, baseline, randomization unit, alpha, power, and minimum useful effect in advance. Correlated user turns reduce effective sample size.
- [INFERENCE] Use pass@k when selection among candidates is available; pass^k better reflects repeated-run consistency. For capacity, pair arrival rate, residence time, and concurrency; persistent queue growth means arrivals exceed completions.

## Worked example

**Scenario:** An extraction service has a 99.9% 30-day SLO and receives 10,000 requests/day. One day has 100 task failures and 1,200 attempts for 1,000 operations. Usage shows 50,000 cache-read, 10,000 cache-write, and 5,000 uncached tokens. Assume $3/MTok and five-minute write/read multipliers of 1.25x/0.1x.

1. Daily task success ratio = 9,900/10,000 = **99%**. One day's measurement does not determine whether the rolling 30-day SLO is met; calculate over the actual objective window. (F1, F2)
2. Objective error ratio = 1 − .999 = **0.1%**. Today's 1% failure ratio is **10x burn** relative to the allowed rate. (F3, F4)
3. Retry amplification = 1,200/1,000 = **1.2x**. Attribute extra attempts to SDK retry, application retry, or duplicate submissions before mitigation. (F29, F30)
4. Cache read share = 50,000/(50,000+10,000+5,000) = **76.9%**. (F11)
5. Effective input charge = [(5,000×3)+(10,000×3×1.25)+(50,000×3×0.1)]/1,000,000 = **$0.0525** at illustrative prices. Recalculate against the actual model price and applicable modifiers. (F14-F16)

Arithmetic is hand-runnable.

## Diagram spec

**Type:** flow. Nodes: task received → queue → Claude call → tools/retry loop → validator → outcome and SLI/cost/retry metrics. Record timestamps and token usage per call; only validated terminal outcomes count as successes. **Caption:** Connect Claude usage to outcomes across queues, tools, and retries.

## Exam lens

- [INFERENCE] Distinguish response success from task success when defining an SLI.
- [INFERENCE] Do not confuse input_tokens or token read share with total input or request hit rate.
- [INFERENCE] Separate TTFT, completion latency, and tail behavior.
- [INFERENCE] Choose pass@k versus pass^k for the outcome being measured; account for power.

## Common mistakes

- Calling input_tokens / total input the cache hit rate. It excludes cache reads and writes; calculate the complete total first. (F11, F12)
- Summing streaming usage snapshots when message_delta values are cumulative. (F10)
- Comparing p99 values from different interpolation or aggregation methods as if the difference necessarily reflects regression. (F6)
- Dividing output tokens by total request duration to claim generation throughput; that denominator may include TTFT and queue/tool delay. [INFERENCE] (F7)
- Reporting pass@k as a guarantee every repeated production run succeeds; pass^k captures the all-success event. (F31, F33)
- Reporting raw rater agreement without prevalence context or chance-adjusted kappa, or treating qualitative kappa cutoffs as universal. (F25)
- Treating MDE as the observed effect, or interpreting low power as evidence of no effect. [INFERENCE] (F26, F27)
- Applying Little's law to unstable queues or mixing per-second arrival rate with millisecond residence time without unit conversion. (F28)
- Retrying refusals, context overflow, and transient transport errors through one generic retry path. Stop reasons and API errors require distinct handling. (F17, F18, F30)

## Self-check

1. **A request has 500 uncached input tokens, 1,000 cache-write tokens, and 8,500 cache-read tokens. What is total input and read share?** Total is 10,000; read share is 85%. (F11)
2. **A system succeeds independently 90% of the time. What are pass@2 and pass^2?** Pass@2 = 1−.1² = 99%; pass^2 = .9² = 81%. (F31, F33)
3. **A 99.9% SLO sees 0.5% bad requests in a window. What is burn rate?** .005/.001 = 5x. (F3, F4)

## Unresolved

- Anthropic usage fields support token-volume cache shares, not a universal request hit-rate formula; this packet defines one and excludes ineligible requests.
- Output tokens/s and cost per successful task are derived metrics. Specify timing, success validation, billing scope, retries, and modifiers.
- NIST notes percentile interpolation differs; pin the method, especially for small samples.
- The +5 point MDE is hypothetical. Claude cache thresholds, prices, models, and retry defaults are version-sensitive; citations reflect 2026-11-19.

