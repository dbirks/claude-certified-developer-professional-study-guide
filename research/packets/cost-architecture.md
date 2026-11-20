# 6.1 Cost Architecture at Scale

> Evaluating fleet-level optimization strategies using usage and cost data, including cost modeling and forecasting, model routing and cascades across the Claude model family, caching strategy and cache diagnostics, batch-versus-realtime economics, and per-tenant budget enforcement.

## Scope map

- Cost modeling and forecasting → Core facts; Exact API / config details; Practitioner reasoning; Worked example(s).
- Model routing and cascades across the Claude model family → Core facts; Exact API / config details; Practitioner reasoning; Worked example(s); Diagram spec.
- Caching strategy and cache diagnostics → Core facts; Exact API / config details; Practitioner reasoning; Common mistakes.
- Batch-versus-realtime economics → Core facts; Exact API / config details; Practitioner reasoning; Worked example(s).
- Per-tenant budget enforcement → Core facts; Exact API / config details; Practitioner reasoning; Diagram spec; Exam lens.

## Core facts

- **Current list pricing (as of 2026-11-19):** Flagship Claude API tiers are **Claude Fable 5.2** ($8 / $40 per input/output MTok), **Claude Opus 5.5** ($4 / $20 per MTok), **Claude Sonnet 5.5** ($2 / $10 per MTok), and **Claude Haiku 5.5** ($0.10 / $0.50 per MTok for prompts <=100,000 tokens; $0.50 / $2.50 per MTok for prompts >100,000 tokens). Output tokens cost 5x base input tokens across all four models. (F1, F2, F3)
- **Long-context pricing and the Haiku 5.5 cliff:** Claude 4.6 and later models (except Claude Haiku 5.5) include the full 1M token context window at flat standard rates. On Claude Haiku 5.5, crossing 100,000 input tokens (including cache reads and cache writes) multiplies every token category—input, cache writes, cache reads, and output—by 5x for that request. (F3, F4)
- **Tokenizer shift across model generations:** Claude 4.7 and later models (including 5/5.5/Fable/Mythos) use a newer tokenizer that produces roughly 30% more tokens for the same text than Claude Sonnet 4.6 and earlier models; forecast costs using `POST /v1/messages/count_tokens` with the target `model` ID rather than extrapolating legacy token counts. (F10, F30)
- **Prompt caching multipliers & break-even:** 5-minute cache writes cost 1.25x base input (breaking even after 1 read); 1-hour cache writes cost 2x base input (breaking even after 2 reads). Cache reads cost **0.025x** base input on Fable/Mythos 5.1 & 5.2 ($0.20–$0.25/MTok), **0.05x** on Opus 5.5 & Sonnet 5.5 ($0.20 and $0.10/MTok), and **0.1x** on all other models (e.g., $0.01/MTok on Haiku 5.5 <=100K). (F2, F5, F6, F7)
- **Caching mechanics & limits:** Prefix matching runs in strict order (`tools` → `system` → `messages`) with up to 4 breakpoints (no per-breakpoint fee) and a 20-block backward lookback window per breakpoint. Minimum cacheable prefix lengths are model-specific (512 tokens on 5.5/5/Fable/Mythos except Sonnet 5 at 1,024; 1,024 on Opus 4.8 and Sonnet 4.6/4.5; 2,048 on Opus 4.7; 4,096 on Opus 4.6/4.5 and Haiku 4.5); shorter prompts silently skip caching without returning an error. (F11, F12, F14)
- **Automatic caching & mixed TTLs:** Top-level `cache_control: {"type": "ephemeral"}` moves a single breakpoint automatically to the last cacheable block (using 1 of the 4 slots; unsupported on Bedrock `bedrock-runtime`). When mixing TTLs in one request, 1-hour breakpoints must precede any 5-minute breakpoints. Cache TTL starts from request initiation, not response completion. (F13, F15)
- **Cache diagnostics (usage fields & diagnostics API):** `usage.input_tokens` reports only uncached tokens after the last breakpoint; `total_input_tokens = cache_read_input_tokens + cache_creation_input_tokens + input_tokens`. In multi-turn agent loops, median production cache read share is 84% (top 10% >=94%); below ~80% indicates a prefix break. Passing `diagnostics: {"previous_message_id": ...}` returns `diagnostics.cache_miss_reason` pinpointing the earliest divergence (`model_changed`, `system_changed`, `tools_changed`, `messages_changed`, `previous_message_not_found`, `unavailable`). (F16, F17, F21)
- **Cache-aware ITPM throughput:** `cache_read_input_tokens` do not count against default ITPM rate limits—only `input_tokens + cache_creation_input_tokens` count—so cache breaks simultaneously increase dollar spend and consume ITPM headroom. (F36)
- **Batch-versus-realtime economics:** The Message Batches API (`POST /v1/messages/batches`) provides a 50% discount on all token charges for async jobs completing within 24 hours (up to 100,000 requests or 256 MB per batch; errored/canceled/expired items unbilled) and stacks with prompt caching. Fast mode (`speed: "fast"`) trades 2x token pricing for up to 2.5x output throughput on supported models and cannot be used with Batch. (F9, F18, F19)
- **Data residency & legacy Priority Tier:** Pinning `inference_geo: "us"` on Claude 4.6+ adds a 1.1x multiplier to every token category (and returns HTTP 400 on pre-4.6 models). Priority Tier commitments are legacy and no longer sold; existing commitments burn down at 0.1x for cache reads, 1.25x/2.00x for 5m/1h writes, and 1.1x for `inference_geo: "us"`. (F8, F20)
- **Model routing, effort, and cascades:** Compare models on **cost per successful task**, not per-token rate, because failed attempts, retries, and downstream repair dominate the bill. Within a single model, `output_config.effort` (`low`, `medium`, `high`, `xhigh`, `max`) scales thinking, tool calls, and output tokens; changing top-level effort mid-conversation can invalidate caches. When outputs have a deterministic verifier, running at `low` effort and re-running only failures at `high` effort (or escalating from Haiku 5.5 to Opus 5.5) beats fixed-high execution on cost at equal or higher pass rate. (F23, F24, F25, F26)
- **Advisor vs. orchestrator multimodel patterns:** Sweep single-model effort before adding a second model. The beta Advisor tool (`advisor_20260301`) lets a smaller executor escalate mid-turn to a frontier advisor (billed separately under `usage.iterations[]`), while an orchestrator fans out independent sub-contexts to cheaper workers. (F28, F29)
- **Attribution & per-tenant budget enforcement:** The beta Usage and Cost Analytics API (`GET /v1/organizations/analytics/usage` and `/cost`) attributes tokens and USD cents by `workspace_id`, `api_key_id`, `actor`, `model`, `service_tier`, `cost_type`, and `token_type` (refreshes ~4h, reconciles up to ~7 days post-month). Workspaces isolate API keys, caches, batches, and monthly spend limits, backed by tier caps (Start $500, Build $1,000, Scale $200,000) and Managed Agents session budgets (`budget.max_list_cost`). (F31, F32, F33, F34, F35, F37)

## Exact API / config details

- **Prompt caching request & usage schema (`/v1/messages`):**
  - Top-level automatic caching: `"cache_control": {"type": "ephemeral"}` (or `{"type": "ephemeral", "ttl": "1h"}`). Consumes 1 of 4 breakpoint slots; returns HTTP 400 if 4 explicit breakpoints are already present or if the last block has an explicit `cache_control` with a mismatched TTL. (F13, F15)
  - Explicit block-level breakpoint: `"cache_control": {"type": "ephemeral", "ttl": "5m" | "1h"}` on tool definitions, `system` blocks, or `messages[].content[]` blocks. (F11, F15)
  - Cache pre-warming (realtime only; rejected in Batch): set `"max_tokens": 0` with an explicit breakpoint on the shared prefix (not on the placeholder user message `"warmup"`), matching `thinking` and `output_config.effort`. Returns `stop_reason: "max_tokens"`, `content: []`, `output_tokens: 0`. (F19)
  - Response `usage` breakdown: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`, plus `usage.cache_creation.ephemeral_5m_input_tokens` and `usage.cache_creation.ephemeral_1h_input_tokens` (whose sum equals `cache_creation_input_tokens`). (F16)
- **Cache diagnostics (`/v1/messages`):**
  - Opt in on turn 1 with `"diagnostics": {"previous_message_id": null}`; pass `"diagnostics": {"previous_message_id": "<msg_id>"}` on subsequent turns within the same workspace. (F17)
  - Response `diagnostics`: `null` (no divergence or opted out), `{"cache_miss_reason": null}` (comparison still running), or `{"cache_miss_reason": {"type": "<reason>", "cache_missed_input_tokens": <int>}}`. Valid `type` values: `"model_changed"`, `"system_changed"`, `"tools_changed"`, `"messages_changed"`, `"previous_message_not_found"`, `"unavailable"`. (F17)
- **Effort & Task Budgets (`/v1/messages`):**
  - `"output_config": {"effort": "low" | "medium" | "high" | "xhigh" | "max"}` (default `"medium"` on `claude-opus-5-5` and `claude-haiku-5-5`; `"high"` on other effort-supporting models). Note: `"thinking": {"type": "disabled"}` returns HTTP 400 on Opus 5.5, Fable 5/5.1/5.2, and Mythos 5/5.1/5.2; on Sonnet 5.5 use `"thinking": {"type": "between_tools"}` (at `low`/`medium`/`high` only; `xhigh`/`max` return 400). (F26)
  - Advisory loop budget (beta header `task-budgets-2026-03-13`): `"output_config": {"task_budget": {"type": "tokens", "total": 64000}}` (minimum/behavior is advisory countdown across thinking, tool calls, tool results, and output).
- **Advisor tool (`tools[]`, beta header `advisor-tool-2026-03-01`):**
  - Tool definition: `{"type": "advisor_20260301", "name": "advisor", "model": "<advisor-model-id>", "max_uses": <int>, "max_tokens": <int>=1024+, "caching": {"type": "ephemeral", "ttl": "5m" | "1h"}}`. (F28)
  - Billing: top-level `usage` excludes advisor tokens; `usage.iterations[]` separates `type: "message"` (executor rate) and `type: "advisor_message"` (advisor rate). Advisor `max_uses` exceeded returns `advisor_tool_result_error` with `error_code: "max_uses_exceeded"` without failing the request. (F28)
- **Batch API (`/v1/messages/batches`):**
  - Payload: `{"requests": [{"custom_id": "^[a-zA-Z0-9_-]{1,64}$", "params": { ...Messages params... }}]}`. Limits: 100,000 requests or 256 MB per batch; 24-hour expiration; 29-day result retention; `max_tokens >= 1`. Unsupported `params`: `stream: true`, `speed`, `fallbacks`, `max_tokens: 0`. (F18, F19)
  - Item `result.type`: `"succeeded"`, `"errored"`, `"canceled"`, `"expired"`. Only `"succeeded"` requests are billed. (F18)
- **Token Counting API (`POST /v1/messages/count_tokens`):**
  - Accepts `model`, `system`, `tools`, `thinking`, `messages` (including base64 PDFs/images, excluding `url`/`file` document sources). Returns `{"input_tokens": <int>}`. Free; independent RPM limits (Start 5,000 / Build 10,000 / Scale 20,000 RPM). (F30)
- **Data residency & Legacy Service Tiers (`/v1/messages`):**
  - `"inference_geo": "global" | "us"`; workspace defaults/restrictions via `data_residency.allowed_inference_geos` and `data_residency.default_inference_geo` on Workspaces Admin API. Response echoes `usage.inference_geo`. (F8)
  - `"service_tier": "auto" | "standard_only"`; response echoes `usage.service_tier` (`"standard"` or `"priority"`). (F20)
- **Usage & Cost Analytics API (beta header `analytics-usage-cost-2026-08-24`):**
  - Endpoints: `GET /v1/organizations/analytics/usage` and `GET /v1/organizations/analytics/cost` (Admin API key `sk-ant-admin01-...`, `org:admin` OAuth bearer token, or non-workspace-scoped key; legacy endpoints `/v1/organizations/usage_report/messages` and `/cost_report` remain supported with ~5-minute freshness and `workspace_id: null` for Default Workspace). (F31)
  - Query params: `starting_at` (RFC 3339, >=2026-01-01, within 365 days, max 31-day span, max 24h for `1m` buckets), `ending_at`, `time_bucket_width` (`1m` | `1h` | `1d`), `group_by[]` (up to 5 of `workspace_id`, `api_key_id`, `actor`, `actor_type`, `model`, `service_tier`, `inference_geo`, `speed`, `context_window`, `product`, etc.; `/cost` adds `cost_type` and `token_type` outside the 5-dimension limit), filters (`workspace_ids[]`, `api_key_ids[]`, `models[]`, up to 100 values each), `limit` (1–1,000), `page`. (F31, F32)
  - Cost units: decimal string in USD cents with 6 decimals (`"41280.000000"` = $412.80 USD) for both `cost.amount` (post-discount, pre-credit) and `cost.list_amount`. Note: Priority Tier usage shows `"0.000000"` token cost in `/cost`. (F32)
- **Workspaces & Spend Limit Errors:**
  - Workspace IDs use `wrkspc_` prefix (100 active workspaces max by default); response header `anthropic-workspace-id` identifies which workspace processed the request. Requests with a non-workspace-scoped key select workspace via `anthropic-workspace-id` request header. (F34)
  - **Spend-limit HTTP errors:** Org tier cap reached → HTTP `429`, `error.type: "rate_limit_error"`, `error.details.error_code: "enforced_spend_limit_reached"`, **no `retry-after` header**. User-configured org or workspace spend limit reached → HTTP `400`, `error.type: "invalid_request_error"`, message starting with `You have reached your specified API usage limits` or `You have reached your specified workspace API usage limits` (Claude Code workspace limits can return 429 with `retry-after`). Do **not** retry spend-limit errors. (F35)
- **Managed Agents Session Budgets (beta header `managed-agents-2026-04-01`):**
  - `POST /v1/sessions`: `"budget": {"type": "limit", "max_list_cost": {"amount": "125", "currency": "USD"}}` (`amount` in whole US cents as string). Stops new requests at cap with `stop_reason: "budget_reached"` (in-flight request completes, so final cost may slightly exceed cap). (F37)

## Practitioner reasoning

- **Order of operations for fleet optimization:** Start with free wins before trading quality: (1) enable prompt caching and keep prefixes byte-stable (`tools` → `system` → `messages`), (2) trim dead input tokens (defer unused MCP tools with `defer_loading`, keep 3–5 hot tools loaded, upload large CSVs for code execution rather than pasting into prompts, compact before Haiku 5.5's 100k cliff), (3) audit legacy prompts that force redundant verification steps on newer models, and (4) move non-interactive workloads to Batch API. Only then tune `output_config.effort`, test model downgrades, or add cascades. (F3, F11, F18, F21, F29)
- **Cache TTL selection rule (5-minute vs 1-hour):** Because 1h writes cost 2x vs 1.25x for 5m (+60% write premium) and cache reads cost 0.025x–0.1x, continuous agent loops with second-scale turn gaps lose money on 1h TTL (~15–19% higher cost on Opus/Sonnet 5.5). Switch to 1h TTL only when >=~5% of turns (1 in 20; mathematical break-even ~1 in 30) experience pauses between 5 and 60 minutes and few exceed 1 hour. `[INFERENCE]` On Fable 5.1/5.2 (0.025x read = $0.20/MTok vs $16/MTok 1h write), a `max_tokens: 0` keep-alive ping every 4 minutes is far cheaper than a 1h write for moderate pauses, unless `thinking.type: "enabled"`, structured outputs, or forced `tool_choice` blocks `max_tokens: 0`. (F5, F6, F22)
- **Mid-conversation changes without cache thrashing:** On a 100k-token cached conversation, mutating `system` or top-level `output_config.effort` invalidates the entire downstream prefix—costing 20–50x more on that turn than appending a `{"role": "system"}` message or per-message `output_config` (where supported), and on models with preserved-thinking prefix checks (Opus 5.5, Fable 5.2), mutating `system`/`tools` with prior thinking blocks triggers HTTP 400. Time irreversible prompt/tool changes right after compaction rather than mid-session. (F11, F26)
- **Batch + caching stack:** Concurrent batch items execute out of order, so 5m caches often miss. For shared prefixes, pre-warm a **1-hour** cache with one synchronous `Messages` call (`max_tokens: 0` is rejected inside Batch), await its start/completion, then submit the batch so workers hit the 1h cache at 50% off. `[INFERENCE]` Confirm SLAs first: batch takes up to 24h, expires if unfinished, and is ineligible for `speed: "fast"` or ZDR. (F15, F18, F19)
- **Retries, tail tasks, and cost per successful task:** `[INFERENCE]` With first-pass probability $p$ and attempt cost $c$, $k$ same-tier retries cost $c \sum_{i=0}^{k-1} (1-p)^i$ for success $1 - (1-p)^k$; for capability gaps or `max_tokens` cutoffs, retries multiply cost with near-zero lift. Escalation cascades (Haiku 5.5 or Opus 5.5 `low` first, escalating verifier failures to Opus 5.5 `high` or Fable 5.2) focus frontier spend on the ~10–20% tail and cut mean cost per solved task by 40–75%. (F23, F24, F25, F27)
- **Per-tenant budget enforcement:** `[INFERENCE]` Workspaces alone hit three SaaS limits: 100 active workspaces default cap, coarse monthly stops (`400 invalid_request_error`), and slight Batch overshoots. Use **Workspaces** for tier/environment isolation and cache/batch boundaries, and enforce **per-tenant quotas in an application gateway** (pre-check via `count_tokens`, meter `usage` + `usage.iterations[]` in real time, reconcile daily against `/v1/organizations/analytics/cost`). (F19, F28, F30, F31, F34, F35)

## Worked example(s)

**Numerical cost model (date: 2026-11-19; official Claude API list prices; arithmetic verified, not a runnable script):**

Consider a multi-tenant support engineering platform executing **100,000 multi-turn agent tasks/month**, averaging **10 turns/task**:
- Stable prefix (`tools` + `system`): **10,000 tokens** (>=512 token minimum).
- New input per turn (user prompt / tool output): **1,000 tokens**; model output per turn: **500 tokens** (total output = **5,000 tokens/task**).
- Across 10 turns with append-only history, turn $t$ sends $11,000 + 1,500(t-1)$ input tokens:
  - Total input tokens/task = $\sum_{t=1}^{10} [11,000 + 1,500(t-1)] = 177,500$ tokens (`0.1775 MTok`).
  - With automatic caching (5m TTL), turn 1 writes `11,000` tokens; turns 2–10 write `1,500` new tokens/turn and read the prior prefix. Total writes = $11,000 + 9 \times 1,500 = 24,500$ tokens (`0.0245 MTok`); total reads = $177,500 - 24,500 = 153,000$ tokens (`0.1530 MTok`). Max single-turn prompt = `24,500` tokens (below Haiku 5.5's 100K threshold).

| Architecture (all 2026-11-19 list prices) | Input / Cache Write / Cache Read / Output | Cost / Attempt | Pass Rate | Cost / Successful Task | Monthly Fleet Cost (100k tasks) |
|---|---|---:|---:|---:|---:|
| 1. Uncached `claude-opus-5-5` (realtime, global) | $0.7100 + $0 + $0 + $0.1000 | $0.8100 | 95% | $0.8526 | $81,000 |
| 2. Cached `claude-opus-5-5` (5m TTL, global) | $0 + $0.1225 + $0.0306 + $0.1000 | $0.2531 | 95% | $0.2664 | $25,310 |
| 3. Cached `claude-opus-5-5` + `inference_geo: "us"` (1.1x) | 1.1 x ($0.2531) | $0.2784 | 95% | $0.2931 | $27,841 |
| 4. Cached `claude-haiku-5-5` (<=100K) alone | $0 + $0.00306 + $0.00153 + $0.00250 | $0.0071 | 80% | $0.0089 | $709 |
| 5. Cascade: Haiku 5.5 (100%) → Opus 5.5 on 20% failures | $0.00709 + 0.20 x $0.2531 | $0.0577 | 99% | $0.0583 | $5,771 |
| 6. Nightly eval/backfill: Cached Opus 5.5 via Batch API (50% off, assuming 100% cache hit post-warmup) | 0.5 x $0.2531 | $0.1266 | 95% | $0.1332 | $12,655 |

- **Key sensitivities:**
  - **Cache break tax:** If a timestamp in `system` breaks the cache on every turn of Architecture 2 (`0.1775 MTok` at $5.00/MTok 5m write instead of reads), input cost jumps from `$0.1531` to `$0.8875/task` (+$73,440/month)—*more expensive than uncached Opus* (`$0.7100` input)!
  - **Retry amplification:** On Architecture 2, retrying every failed attempt twice on the same model without escalation (`(1 - 0.95) = 5%` fail rate, say 2 retries) adds little cost (`~5%`), whereas on a brittle 60%-pass workflow (`40%` fail rate), 2 retries inflate attempt volume by $1 + 0.4 + 0.16 = 1.56\times$ and cost per solved task rises sharply if errors are non-transient.
  - **Haiku 5.5 >100K cliff:** Letting context grow past `100,000` tokens on Haiku 5.5 multiplies Haiku rates 5x (`$0.0355/attempt`), making compaction before `100,000` tokens mandatory.

**Attribution & cache-diagnostic snippet (Python `anthropic` SDK, pseudocode adapted from verified API shapes):**

```python
import anthropic

# 1. Per-request cost + cache diagnostics logging (Messages API)
client = anthropic.Anthropic()

resp = client.beta.messages.create(
    model="claude-opus-5-5",
    max_tokens=64000,
    cache_control={"type": "ephemeral"},
    output_config={"effort": "medium"},
    system="Static system policy...",
    messages=messages,
    diagnostics={"previous_message_id": prev_msg_id},
)

u = resp.usage
total_in = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens
cache_hit_ratio = u.cache_read_input_tokens / total_in if total_in else 0.0
if resp.diagnostics and resp.diagnostics.cache_miss_reason:
    print("Cache miss cause:", resp.diagnostics.cache_miss_reason.type)

# 2. Daily cost attribution by workspace and API key (Admin API key required)
admin = anthropic.Anthropic(api_key=ADMIN_KEY)
rows = admin.beta.organization.analytics.cost.list(
    starting_at="2026-11-01T00:00:00Z",
    ending_at="2026-11-19T00:00:00Z",
    time_bucket_width="1d",
    group_by=["workspace_id", "api_key_id", "model", "service_tier"],
    limit=1000,
)
for row in rows:
    usd = float(row.cost.amount) / 100.0  # amount is USD cents as 6-decimal string
    print(row.starting_at, row.group.workspace_id, row.group.api_key_id, f"${usd:.4f}")
```

## Diagram spec

- **Type:** `flow`
- **Nodes and edges:**
  - `Incoming Request (Tenant ID, SLA, Verifiable?)` → `Gateway Budget Check (Tenant Dollar/Token Ledger)`
  - `Gateway Budget Check` --(over tenant quota)--> `Reject 429 / Degrade Tier`
  - `Gateway Budget Check` --(within quota)--> `SLA & Workload Router`
  - `SLA & Workload Router` --(async / <=24h tolerance)--> `Batch Queue + 1h Pre-warm -> POST /v1/messages/batches (50% off)`
  - `SLA & Workload Router` --(realtime, checkable)--> `Tier 1: Haiku 5.5 (<=100K, cached) or Opus 5.5 low effort`
  - `Tier 1` --> `Deterministic Verifier`
  - `Deterministic Verifier` --(pass)--> `Success Ledger + Usage Telemetry`
  - `Deterministic Verifier` --(fail)--> `Escalate: Opus 5.5 high / Fable 5.2 (1 retry)` --> `Success Ledger + Usage Telemetry`
  - `SLA & Workload Router` --(realtime, high stakes)--> `Opus 5.5 medium/high (or Advisor tool)` --> `Success Ledger + Usage Telemetry`
  - `Success Ledger + Usage Telemetry` --> `Nightly Reconciliation (Analytics Cost API /cost)`
- **Caption:** Cost-optimized multi-tenant Claude routing pipeline combining application-layer quota enforcement, batch offloading, cached tier-1 execution with verifier-gated escalation, and Analytics API cost reconciliation.

## Exam lens

*Editorial inference based on the official November 2026 exam blueprint.*

1. **Simultaneous spend + 429 ITPM spikes at constant RPM:** Suspect **prompt cache invalidation** (timestamp in `system`, non-deterministic tool JSON keys, or top-level `effort`/`tool_choice` changed mid-session)—`cache_read_input_tokens` are ITPM-exempt while cache writes pay 1.25x–2x cost and consume ITPM. Inspect `usage.cache_read_input_tokens` and enable `diagnostics.previous_message_id`.
2. **Effort tuning vs. model downgrade vs. Advisor tool:** Check whether single-model `output_config.effort` was swept first, whether advisor consult rate is near zero (~1,000-token overhead wasted) or too high (2x+ cost), and whether `max_tokens` truncation (`stop_reason: "max_tokens"`) is causing doomed retries.
3. **Spend-limit errors vs. transient 429s:** Distinguish retryable `429` (has `retry-after`) from tier spend cap `429` (`error.details.error_code == "enforced_spend_limit_reached"`, no `retry-after`) and user-configured org/workspace spend caps (`400 invalid_request_error`); never retry spend caps.
4. **Multi-tenant attribution & gating:** For >100 tenants or strict caps, pair Workspace boundaries with an application gateway metering `usage` + `usage.iterations[]` in real time, reconciled via `/v1/organizations/analytics/cost` (`group_by[]=workspace_id`, `api_key_id`, `actor`), respecting its ~4h–24h refresh lag.

## Common mistakes

- **Putting `cache_control` on a per-request block (or using automatic caching with a varying suffix):** Writes occur only at breakpoints; placing a timestamp or user query before/inside the breakpointed block forces a 1.25x write every turn with 0% reads. (F5, F12, F13)
- **Reading `usage.input_tokens` as total prompt size:** `input_tokens` counts only uncached tokens *after* the last breakpoint, masking total prompt length, Haiku 5.5's >100K cliff, and cache-write costs. (F3, F16)
- **Using `max_tokens` as a cost cap:** `max_tokens` is invisible to Claude; truncating turns (`stop_reason: "max_tokens"`) bills wasted tokens and triggers retries. Use `output_config.effort` or `task_budget`. (F26, F27)
- **Retrying spend caps (`enforced_spend_limit_reached` 429 or workspace 400):** Wastes retries against a calendar-month cap with no `retry-after`. (F35)
- **Using `max_tokens: 0` inside Batch requests or 5m TTL for slow batches:** `max_tokens: 0` fails batch validation; pre-warm a 1h cache via one synchronous call before submitting the batch. (F15, F19)
- **Ignoring `usage.iterations[]` with the Advisor tool:** Top-level `usage` omits advisor tokens; price `advisor_message` iterations at the advisor model's rate. (F28)
- **Gating live traffic on the Analytics API:** Analytics data lags ~4h–24h and revises up to ~7 days post-month-end; meter response `usage` locally for enforcement. (F33)

## Self-check

1. **A multi-turn agent on `claude-haiku-5-5` caches a 95,000-token codebase prefix and appends 8,000 tokens of new tool outputs, seeing a sudden 5x jump in cost per request even on cache-hit turns. Why, and what is the fix?**
   - *Answer:* Total prompt length (`cache_read_input_tokens + cache_creation_input_tokens + input_tokens` = 103,000) crossed Haiku 5.5's 100,000-token threshold, multiplying all token rates (including cache reads and output) by 5x. Configure automatic compaction with a trigger below 100,000 minus max per-turn growth (e.g., 90,000). (F3)
2. **You switch a cached multi-turn coding workflow from `claude-opus-4-6` to `claude-opus-5-5`, and also toggle `output_config.effort` from `medium` to `high` mid-conversation at the top level. Identify two distinct cost impacts.**
   - *Answer:* (1) Claude 4.7+ models use a newer tokenizer producing ~30% more tokens for the same text, so raw token counts rise (compare on cost per completed task and re-count with `/v1/messages/count_tokens`). (2) Changing top-level `output_config.effort` mid-conversation can invalidate the prompt cache and re-bill the prefix as cache writes (use per-message effort where supported or hold effort constant per session). (F10, F26, F30)
3. **Why does a sudden drop in `cache_read_input_tokens` trigger HTTP 429 rate-limit errors even when your requests-per-minute (RPM) and total prompt sizes haven't changed?**
   - *Answer:* Under cache-aware ITPM accounting, `cache_read_input_tokens` do not count toward ITPM, whereas `cache_creation_input_tokens` and uncached `input_tokens` do. A cache break converts zero-ITPM reads into full-ITPM writes, exhausting your ITPM bucket. (F36)

## Unresolved

- Exact per-workspace spend limit API endpoint for **Claude Console (Claude Platform)** organizations: `manage-claude/spend-limits-api.md` explicitly states the Spend Limits API (`POST /v1/organizations/spend_limits`) is available to **Claude Enterprise organizations only** and not Claude Console organizations; Console workspace spend limits are documented as configured via the Claude Console UI (`platform.claude.com/settings/spend-limits`).
- Exact per-model step size and starting level for **ramp limits** (`ramp_limit_exceeded`): documented as model-dependent and subject to change without fixed public numbers.
