# 2.2 Scale and Throughput Management

> Analyzing rate-limit strategy, queueing and backpressure, batch pipeline design, multi-tenant quota and isolation, and capacity planning for high-volume Claude workloads, and identifying whether rate limits, token throughput, or batch economics is the binding constraint.

## Scope map

- Rate-limit strategy → Core facts; Exact API / config details; Practitioner reasoning.
- Queueing and backpressure → Practitioner reasoning; Diagram spec.
- Batch pipeline design → Core facts; Exact API / config details; Practitioner reasoning.
- Multi-tenant quota and isolation → Core facts; Practitioner reasoning; Diagram spec.
- Capacity planning for high-volume Claude workloads → Practitioner reasoning; Worked example.
- Binding constraint: rate limits, token throughput, or batch economics → Worked example; Exam lens; Self-check.

## Core facts

- Claude API service-configured limits apply at the organization level; workspace limits are configurable and organization limits still apply even if workspace allocations sum to more. Workspaces can have both custom spend and rate limits; workspace-scoped keys can access resources only in their workspace. (F1, F19, F20, F21)
- Messages limits measure RPM, ITPM, and OTPM by model class. Exceeding any dimension produces HTTP 429; if `retry-after` is present, wait the indicated seconds. (F4)
- Limits use continuously replenished token buckets. A per-minute rate can also be enforced over shorter intervals, so an average below the minute limit does not make an instantaneous burst safe. (F2, F3)
- Default cache-aware ITPM counts `input_tokens` plus `cache_creation_input_tokens`, excluding cache reads. Input rate consumption is initially estimated and then adjusted to actual use. OTPM counts actual output as it is generated; `max_tokens` itself is not the rate-limit charge. (F5, F6, F7)
- On the documented standard Start, Build, and Scale tiers respectively, Claude Sonnet 5.5 limits are 4,000 / 2,000,000 / 400,000; 10,000 / 5,000,000 / 1,000,000; and 13,000 / 10,000,000 / 2,000,000 RPM / ITPM / OTPM. Values are version-sensitive and are examples, not universal account limits. (F8, F9, F10)
- Model classes can share a bucket: Sonnet 4.6 and 4.5 share the Sonnet 4.x bucket; Sonnet 5 and 5.5 each have separate buckets. Inspect the current model/tier table and account limits before estimating available capacity. (F11)
- Ramp limits constrain the speed of growth in token usage and can yield 429 below steady-state ITPM/OTPM. The permitted level follows a recent peak plus a step, subject to the ordinary limit. (F12, F13)
- Asynchronous Message Batches have independent API-request and queued-item rate limits shared across models. A batch has at most 100,000 requests or 256 MB, whichever binds first. Results can be retrieved when all work finishes or after 24 hours; unfinished work expires at 24 hours. Results are downloadable for 29 days from batch creation. (F15, F26, F27, F28)
- Batch usage is charged at 50% of standard API prices. Nearly all Messages request types are supported, while streaming, speed, fallbacks, and `max_tokens: 0` are not. Cache hits in asynchronous batches are best effort. (F29, F30, F31, F32)
- Legacy Priority Tier capacity commitments are closed to new purchases; existing customers can use their commitments through contract end. Do not confuse this service arrangement with the Start/Build/Scale usage tiers. (F35)

## Exact API / config details

- `anthropic-ratelimit-requests-{limit,remaining,reset}`, `anthropic-ratelimit-input-tokens-{limit,remaining,reset}`, `anthropic-ratelimit-output-tokens-{limit,remaining,reset}`, and `anthropic-ratelimit-tokens-{limit,remaining,reset}` are response-header families; reset times are RFC 3339 and remaining token counts are rounded to the nearest thousand. The generic token family shows the most restrictive current limit, not an independently usable extra token budget. The authoritative header table should be consulted for current details. (F24, F25)
- `retry-after` is in seconds. A tier monthly spend cap also produces `429` / `rate_limit_error`, but does not carry `retry-after`; `error.details.error_code` identifies the tier-cap condition as `enforced_spend_limit_reached`. A user-configured organization or workspace spend limit generally yields `400` / `invalid_request_error`, with a documented Claude Code workspace exception. Do not indefinitely retry a spend cap. (F4, F22, F23)
- A ramp error is `429` / `rate_limit_error`, with Messages API `error.details.error_code` of `ramp_limit_exceeded`. Rate inputs and outputs separately and increase successful traffic gradually; the exact step and starting level are model-dependent and may change. Batch is not subject to ramp limits. (F12, F13, F14, F15)
- Batch endpoint: `POST /v1/messages/batches`, with `requests` containing `{custom_id, params}`. Each `custom_id` must be unique within the batch and maps results to requests, which may be returned out of order. Each `params` contains the individual Messages request. (F33)
- Start / Build / Scale Batches API HTTP RPM limits are 1,000 / 2,000 / 4,000, while maximum queued individual batch requests are 200,000 / 300,000 / 500,000; each batch remains capped at 100,000. These are different counts: polling consumes API RPM; each item awaiting processing consumes queue capacity. (F15, F16, F17, F18, F26)
- Results are JSONL with per-item `custom_id` and `result.type`: `succeeded`, `errored`, `canceled`, or `expired`; inspect each outcome. A batch can mix vision, tool use including server tools, system messages, multi-turn inputs, extended thinking and most beta features, subject to each feature's own availability and the unsupported parameter list. `max_tokens` must be at least 1. (F30, F31, F33)
- A workspace key ties a request to that workspace; workspace limits are ceilings, not reserved dedicated organization throughput. A batch can slightly exceed a configured workspace spend limit because processing is concurrent. Enforce stricter local budgets if the overshoot matters. (F19, F20, F21, F34)

## Practitioner reasoning

- [INFERENCE] Maintain a distributed admission controller per organization/model bucket and workspace, accounting for request count, estimated uncached input including likely cache writes, and projected output. Atomically reserve against all applicable budgets, reconcile with observed usage, and bound concurrent in-flight output. Because actual output is produced over time, an output reservation is a local safety policy, not Claude's OTPM accounting rule. Avoid treating rounded remaining headers as a precise transaction ledger. (F5, F6, F7, F24)
- [INFERENCE] Use separate bounded per-tenant queues and weighted fair or deficit-round-robin scheduling, charging estimated token work rather than just request count. Apply both tenant caps and the aggregate organization/model constraint; permit unused shares to be borrowed without guaranteeing dedicated capacity. Separate interactive and bulk service classes, with aging or a reserved share to prevent starvation. A per-tenant API key supports attribution and revocation, but several keys in one workspace do not establish per-tenant workspace caps; add gateway-level accounting or use separate workspaces where appropriate. (F1, F19, F20, F21)
- [INFERENCE] Prevent head-of-line blocking: do not let an oversized job at the front stop smaller admissible jobs for unrelated tenants. Use size classes or bounded look-ahead, and ensure large jobs accumulate credit so they eventually run. Bound queue length and queue age; reject, shed, or return a retryable overload response upstream when demand exceeds the sustainable drain rate. Record queue wait separately from API latency.
- [INFERENCE] On 429, classify the error and respect `retry-after`, with jitter and bounded retry budgets; spread retries instead of synchronized fan-out. Ramp gradually after a deployment, cache cold start, or scheduled job. Distinguish an exhausted monthly cap from a transient rate or ramp condition, and include retries in admission accounting. A cache miss surge increases charged ITPM even if total prompt length and request rate stay fixed. (F4, F5, F12, F14, F22)
- [INFERENCE] For batch, persist a manifest containing a stable job ID, `custom_id`, input fingerprint, submission state and batch ID; shard by both encoded bytes and count, submit within queue and endpoint headroom, poll with backoff, then persist results before retention expires. Join by ID, not position; reconcile each result, repair invalid inputs, and resubmit only retryable, expired or otherwise intentionally retried items. Make downstream writes idempotent and handle ambiguous submission outcomes through reconciliation. Evaluate external side effects before retrying tool-enabled jobs. (F15, F26, F27, F28, F33)
- [INFERENCE] Compare the value of the 50% batch discount with waiting time, expiry risk, lower or uncertain cache-hit rate, pipeline overhead and deadline penalties. Batch is attractive for tolerant offline work, but is not proof that a hard deadline can be met. Consider workspace spend overshoot in the financial reserve. (F27, F29, F32, F34)
- [INFERENCE] Track per-bucket RPM, uncached and cache-creation ITPM, OTPM, cache-read share, queue age, in-flight work, 429 reason, spend and batch item outcomes. Compare peak short-window demand to limits and reserve headroom for variance, growth, cache misses and retries. The maximum sustainable average request rate is bounded by the smallest of RPM, ITPM divided by charged input per request, and OTPM divided by actual output per request. These averages are planning estimates, not burst, concurrency or latency guarantees. (F3, F4, F5, F7)

## Worked example(s)

**Hypothetical planning arithmetic, not a runnable SDK example.** Assume a single model bucket with limits 1,000 RPM, 2,000,000 ITPM, 400,000 OTPM; actual offered rate is a steady 400 requests/minute. Ignore workspace sublimits, ramping, retries and burstiness for the arithmetic only. All token counts here are hypothetical; Claude counts cache reads differently from writes and ordinary input. (F4, F5, F7)

| Condition | Charged input/request | Actual output/request | RPM load | ITPM load | OTPM load | Tightest utilization |
|---|---:|---:|---:|---:|---:|---|
| Before growth | 2,000 | 400 | 400 / 1,000 = 40% | 800,000 / 2,000,000 = 40% | 160,000 / 400,000 = 40% | Three-way tie |
| After growth | 6,000 | 400 | 40% | 2,400,000 / 2,000,000 = 120% | 40% | ITPM binds |
| After stable-prefix reuse | 3,000 charged + 3,000 cache-read | 400 | 40% | 1,200,000 / 2,000,000 = 60% | 40% | ITPM remains tightest, under limit |

At 6,000 charged tokens per request the theoretical input bound is 2,000,000 / 6,000 = approximately 333 requests/minute; RPM allows 1,000 and OTPM allows 1,000. The backlog grows by roughly 67 requests per minute if all 400 arrive and the system sustains that simplified input bound. At 3,000 charged tokens, the estimated input bound is approximately 667 requests/minute. This assumes the 3,000 cached tokens are actual reads, not first writes; cold caches or invalidation can undo the gain. Real scheduling must leave burst and ramp headroom. (F2, F3, F5, F6, F12)

If 100,000 of these tasks have no interactive deadline and cost a hypothetical $0.02 each at standard pricing, the simplified standard token bill is $2,000 and batch at 50% is $1,000. This ignores other charges, cache pricing differences, failures and operational cost; test the business deadline and actual rates rather than assuming the savings outweigh delay. The item count exactly reaches the batch count ceiling, but encoded size may require multiple batches. (F26, F27, F29, F32)

## Diagram spec

Type: flow. Nodes: tenant clients; per-tenant bounded queues; fair token-aware scheduler; organization/model and workspace admission budgets; interactive Messages API; batch manifest/sharder; Batches API; result reconciliation and durable store; metrics and feedback. Edges: clients → queues → scheduler → admission → interactive API; eligible offline queue → manifest/sharder → batch API → reconciliation → store; usage, errors and queue age → metrics → scheduler/admission. Caption: One shared admission layer protects organization capacity while isolating tenants and separating deadline-sensitive work from asynchronous throughput.

## Exam lens

- [Editorial inference] Stable RPM with rising uncached prompt length and input-rate 429 points to ITPM; reducing request bursts alone cannot fix a sustained input deficit.
- [Editorial inference] A tenant-specific workspace cap helps contain that tenant, but shared organization limits and other tenants' traffic still constrain available capacity.
- [Editorial inference] Offline jobs with tolerant deadlines favor batch economics; a strict synchronous SLA or incomplete results after expiry changes the decision.
- [Editorial inference] A ramp 429 below steady-state ceilings calls for gradual growth; a monthly spend-cap 429 requires budget or tier remediation, not a retry storm.

## Common mistakes

- Counting cache reads as default ITPM, or forgetting that cache creation does count. (F5)
- Treating `max_tokens` as actual OTPM consumption or average minute headroom as burst protection. (F3, F7)
- Assuming API keys in one workspace guarantee per-key throughput or workspace caps reserve capacity against the organization. (F19, F20, F21)
- Assuming batch finishes within an hour, results remain indefinitely, or results are ordered like inputs. (F27, F28, F33)
- Applying retry loops to every 429 or treating a configurable spend-limit 400 as malformed input without inspecting its message. (F22, F23)

## Self-check

1. A request uses 1,000 uncached, 2,000 cache-write and 7,000 cache-read input tokens. What counts against default ITPM? **3,000 tokens**; the 7,000 reads are excluded. (F5)
2. A workspace caps ITPM at 50,000 but the organization has 10,000 ITPM of remaining capacity. Can this workspace count on 50,000 immediately? **No**; the organization limit also applies, and short-window and ramp constraints can further restrict admission. (F3, F12, F19)
3. A batch returns `expired` for some IDs and `succeeded` for others. What should the pipeline do? **Persist and deduplicate successes; selectively reconcile and resubmit eligible expired items**, observing deadlines, remaining queue capacity, and side effects. (F15, F27, F33)

## Unresolved

- The rendered source exposes tier tables in adjacent tab panels; the selected examples and quota rows above follow the displayed Start → Build → Scale tab order. The complete changing per-model table and configured account-specific limits must be checked in the source and Console. No blanket per-key quota guarantee was verified.
- The documentation does not specify a fixed completion SLA below the 24-hour expiration, a universal ramp step, or an exactly-once batch submission guarantee. Engineer for those uncertainties.
- The repository currently has no `scripts/verify-quotes.mjs`, so that specific checker cannot be run here; quote verification used reopened primary source pages and local YAML checks instead.
