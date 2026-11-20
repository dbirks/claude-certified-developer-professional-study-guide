# 3.2 Production Monitoring and Alerting

Official objective:
> Analyzing production signals from LLM-backed services to define service level indicators (SLIs) and SLOs, design alerting and dashboards (including token and cost telemetry), and detect quality drift, behavioral regressions, and anomalous usage, including drift after model updates.

## Scope map

| Official sub-objective | Packet section(s) |
|---|---|
| Analyzing production signals from LLM-backed services to define SLIs and SLOs | Core facts; Exact API / config details; Practitioner reasoning; Worked example(s) |
| Design alerting and dashboards (including token and cost telemetry) | Core facts; Exact API / config details; Practitioner reasoning; Worked example(s); Diagram spec |
| Detect quality drift and behavioral regressions | Core facts; Exact API / config details; Practitioner reasoning; Common mistakes |
| Detect anomalous usage (spend spikes, per-key/workspace limits) | Core facts; Exact API / config details; Practitioner reasoning; Worked example(s) |
| Detect drift after model updates (pinned snapshot vs. alias, deprecations) | Core facts; Exact API / config details; Exam lens; Common mistakes |

## Core facts

* **SLIs, SLOs, and error budgets:** An SLI is a quantitative ratio, average, or percentile measuring user-experienced service level, and an SLO sets its target range over a compliance window (F1). Google SRE advises keeping SLOs minimal—covering availability/task success, latency (TTFT and end-to-end percentiles), and quality—while deriving an error budget (`1 - SLO`) to drive release gates and alerting (F1, F2, F9).
* **Multi-window, multi-burn-rate (MWMBR) alerting:** Burn rate measures error-budget consumption speed relative to the SLO window (`observed_error_ratio / (1 - SLO)`) (F3). Pairing a long window with a short window (`1/12` of the long window) ensures alerts fire only during active burn and reset rapidly on recovery (F4). For a 30-day 99.9% SLO, Google SRE pages at `14.4x` (`2%` budget in `1h / 5m`) and `6x` (`5%` in `6h / 30m`), and creates a ticket at `1x` (`10%` in `3d / 6h`) (F5). Low-traffic endpoints distort burn rates (a single failure can look like `1,000x`) and require synthetic traffic, service aggregation, or widened windows (F6).
* **LLM latency, stop-reason, refusal, and quality SLIs:** Interactive apps track Time to First Token (TTFT) separately from end-to-end latency percentiles, tuning `output_config.effort` (e.g., `"low"` on Haiku 5.5) when latency targets tighten (F7, F8). Because every HTTP `200` Messages response carries `stop_reason`, dashboards must separate non-`end_turn` terminations (`max_tokens`, `model_context_window_exceeded`, `refusal`) from `4xx`/`5xx` HTTP errors (F11, F12). Classifier refusals arrive as `200` streams with `stop_reason: "refusal"` and `stop_details.category` (F12); Claude Code OTel separates `claude_code.api_refusal` from `claude_code.api_error` (F19). Grounded-answer rate is tracked via quote/citation verification checks (F10), and tool failure rate via tool execution results (`claude_code.tool_result` `success="false"`, Managed Agents Inspector **Tools** tab) (F19, F22).
* **Token and cost telemetry:**
  * **Usage and Cost Analytics API (beta, recommended):** `GET /v1/organizations/analytics/usage` and `/cost` (`anthropic-beta: analytics-usage-cost-2026-08-24`) report tokens, `requests`, and USD cents (`6` decimals) down to `1m` buckets across up to `5` `group_by[]` dimensions (F13, F15). Freshness is `4–24h` with month-end reconciliation up to `~7 days` post-month; pin `ending_at <= data_refreshed_at` for stable reads (F14).
  * **Legacy Usage and Cost API:** `/v1/organizations/usage_report/messages` and `/cost_report` refresh within `~5 minutes` (useful for near-real-time anomaly checks) but lack `requests` and Default Workspace IDs (F16).
  * **Claude Console, Claude Code, API OTel, and Managed Agents:** Console **Usage** and **Cost** show token, rate-limit headroom, and cache hit-rate charts (F23). `GET /v1/organizations/usage_report/claude_code` reports daily productivity and cost (`~1h` lag) (F17); Claude Code OTel (`CLAUDE_CODE_ENABLE_TELEMETRY=1`) exports real-time metrics (`claude_code.cost.usage`, `claude_code.token.usage`, `claude_code.code_edit_tool.decision`), events, and beta `claude_code.llm_request` spans (`ttft_ms`, `first_content_ms`) (F18, F20). Claude API OTel spans (beta) emit GenAI semconv billed tokens even on failed/canceled calls (F21), and Managed Agents emits `session.usage` snapshots (`list_cost`, `active_seconds`) on idle transitions and budget pauses (F22).
* **Quality drift, behavioral regressions, and model updates:** Production monitoring catches distribution drift missed by offline CI/CD evals, paired with `pass^k` consistency metrics and manual transcript review (F25, F26). Prompt cache drops (`cache_read_input_tokens -> 0`) both spike cost and consume uncached ITPM headroom; diagnose prefix divergence via `diagnostics.previous_message_id` (F23, F24). Claude `4.6+` dateless IDs (`claude-sonnet-4-6`, `claude-sonnet-5`) are **pinned snapshots** with frozen weights, unlike pre-4.6 rolling aliases (`claude-sonnet-4-5`) (F27)—though serving-infrastructure updates (routers, classifiers, sampling) can still shift behavior on pinned IDs (F28). First-party retirements carry `>=60 days` notice; Bedrock and Google-managed Vertex AI maintain separate schedules (F29).
* **Anomalous usage and spend guardrails:** Tier caps (`Start` `$500`, `Build` `$1,000`, `Scale` `$200,000`) fail with `429 rate_limit_error` (`enforced_spend_limit_reached`, no `retry-after`); self-set org/workspace limits fail with `400 invalid_request_error` (Claude Code workspaces may return `429`) and support Console email alerts (F30, F32). Traffic spikes trigger ramp-limit `429` (`ramp_limit_exceeded`) below nominal ITPM/OTPM (F31). Workspaces (`wrkspc_...`, `anthropic-workspace-id` header) isolate keys and limits (F32); Enterprise orgs manage per-user limits via the Spend Limits API (F33).

## Exact API / config details

### 1. Usage & Cost Admin APIs (First-party Anthropic)

| API | Endpoint(s) | Auth & Required Headers | Bucket Widths & Freshness | Key Notes |
|---|---|---|---|---|
| **Usage & Cost Analytics API (Beta)** | `GET /v1/organizations/analytics/usage`<br>`GET /v1/organizations/analytics/cost` | Admin key (`sk-ant-admin...`), `org:admin` OAuth, or Enterprise `read:analytics` key.<br>`anthropic-version: 2026-10-21`<br>`anthropic-beta: analytics-usage-cost-2026-08-24` (F13) | `1m` (max 24h), `1h`, `1d` (max 31d, <= 365d back).<br>Freshness `4h–24h`; reconciled `~7d` post-month (F14). | Up to 5 `group_by[]` dims (`actor`, `api_key_id`, `workspace_id`, `model`, `service_tier`, `context_window`, `product`, `agent_id`, `session_id`, `inference_geo`, `speed`). `/cost` returns USD cents (`"41280.000000"`) + `cost_type`/`token_type` outside the 5-dim/`limit` cap (F15). Pin `ending_at <= data_refreshed_at` (F14). |
| **Usage & Cost API (Legacy)** | `GET /v1/organizations/usage_report/messages`<br>`GET /v1/organizations/cost_report` | Admin key / `org:admin` OAuth / non-workspace key (no beta header) (F16). | `bucket_width`: `1m`, `1h`, `1d`.<br>`~5m` freshness (F16). | Useful for near-real-time anomaly checks; returns `null` `workspace_id` for Default Workspace, omits `requests` and code execution, unavailable on Claude Platform on AWS (F16). |
| **Claude Code Analytics API** | `GET /v1/organizations/usage_report/claude_code` | Admin key / `org:admin` OAuth (no workspace keys) (F17). | Single UTC day (`YYYY-MM-DD`); `<= 1h` lag; `limit` 20 (max 1000) (F17). | Returns `num_sessions`, `lines_of_code.{added,removed}`, commits, PRs, `{edit,multi_edit,write,notebook_edit}_tool.{accepted,rejected}`, per-model tokens & `estimated_cost.amount` (cents) (F17). |
| **Spend Limits API (Enterprise only)** | `GET .../spend_limits/effective`, `POST/DELETE .../spend_limits`, `.../spend_limit_increase_requests/{id}/{approve,deny}` | Scoped Admin key (`read:spend_limits` / `write:spend_limits`) (F33). | Real-time `period_to_date_spend` & resolved `source` (F33). | Claude Enterprise only; unavailable for Claude Platform (Console) organizations (F33). |

### 2. Claude Code & Claude API OpenTelemetry Telemetry

* **Claude Code OTel enablement (`env` or managed `settings.json`, ignored in repo `.claude/settings*.json`):**
  * `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp` (or `prometheus`, `console`, `none`), `OTEL_LOGS_EXPORTER=otlp` (F18).
  * Beta traces: `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`, `OTEL_TRACES_EXPORTER=otlp`, `OTEL_TRACES_EXPORT_INTERVAL=5000` (F20). Propagates W3C `traceparent` to Anthropic API (`traceresponse` span link) and HTTP MCP servers; set `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` when using a custom `ANTHROPIC_BASE_URL` proxy (F20).
  * Privacy gates (redacted by default): `OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_ASSISTANT_RESPONSES=1`, `OTEL_LOG_TOOL_DETAILS=1`, `OTEL_LOG_TOOL_CONTENT=1`, `OTEL_LOG_RAW_API_BODIES=1|file:<dir>` (F18, F20).
* **Key Claude Code OTel metrics:** `claude_code.session.count` (`start_type`), `claude_code.cost.usage` (`USD`), `claude_code.token.usage` (`type`: `"input"`, `"output"`, `"cacheRead"`, `"cacheCreation"`), `claude_code.code_edit_tool.decision` (`decision`: `"accept"`/`"reject"`), `claude_code.active_time.total` (`s`), `claude_code.lines_of_code.count`, `claude_code.commit.count`, `claude_code.pull_request.count` (F18).
* **Key Claude Code OTel events & span attributes:**
  * Events: `claude_code.api_request` (`duration_ms`, `cost_usd`, `cost_usd_micros`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `request_id`), `claude_code.api_error` (`status_code`, `attempt`, `client_request_id`), `claude_code.api_refusal` (HTTP 200 refusals), `claude_code.tool_result` (`tool_name`, `tool_use_id`, `request_id`, `success`, `duration_ms`, `error_type`) (F19).
  * `claude_code.llm_request` span: `ttft_ms`, `first_content_ms` (v2.1.268+), `duration_ms`, `stop_reason`, `error_class`, `attempt`, `effort`, `speed` (F20).
* **Claude API & SDK OTel spans (beta):** Emits `anthropic.messages.create`, `anthropic.model_request`, `anthropic.tool_use <tool>`, `anthropic.compaction` with `gen_ai.usage.input_tokens` (includes cache reads/writes), `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_write.input_tokens`, and `anthropic.usage.cache_creation.ephemeral_{5m,1h}_input_tokens` (F21).

### 3. Messages API Signals, Error Codes, and Cache Diagnostics

* **Per-response SLIs:** `response.stop_reason` (`end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal`, `model_context_window_exceeded`) (F11); `response.stop_details.category` on refusals (F12); `request-id` (`_request_id` in Python/TS SDKs) and `anthropic-workspace-id` response headers (F32); `usage.cache_read_input_tokens` vs. `input_tokens + cache_creation_input_tokens` (uncached ITPM) (F23).
* **Cache diagnostics opt-in:** Send `diagnostics: {"previous_message_id": null}` on turn 1 and `previous_message_id: msg.id` on subsequent turns to pinpoint prefix divergence (`model`, `system`, `tools`, or `messages`) (F24).
* **Spend/rate-limit anomaly signals:**
  * `400 invalid_request_error`: Org or workspace self-imposed spend limit reached (`You have reached your specified [workspace] API usage limits...`) (F30).
  * `429 rate_limit_error`: RPM/ITPM/OTPM exceeded (honor `retry-after` and `anthropic-ratelimit-*` headers); `error.details.error_code == "ramp_limit_exceeded"` (spike above recent per-minute peak) (F31); or `enforced_spend_limit_reached` (tier cap hit, **no `retry-after` header**) (F30).

### 4. Model IDs, Snapshots vs. Aliases, and Deprecation Lifecycle

* **4.6+ models:** Dateless IDs (`claude-sonnet-4-6`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-opus-5-5`, `claude-haiku-5-5`) are **pinned snapshots**, not rolling aliases (F27).
* **Pre-4.6 models:** Dated snapshots (`claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`) plus optional rolling aliases (`claude-sonnet-4-5`) (F27).
* **Lifecycle:** `Active` -> `Legacy` -> `Deprecated` (>= `60 days` notice on first-party) -> `Retired` (requests fail) (F29). Note: `claude-sonnet-4-5-20250929` (and alias `claude-sonnet-4-5`) is scheduled for retirement November 30, 2026 (replacement: `claude-sonnet-5-5`).

## Practitioner reasoning

### 1. Four-layer LLM SLIs

`[INFERENCE]` HTTP `5xx` alone misses the most common LLM failures: HTTP `200` responses that are truncated (`max_tokens`, `model_context_window_exceeded`), refused (`refusal`), ungrounded, or stuck in tool loops. Keep SLOs focused on four layers (F2, F9):

1. **Availability / Completion Yield:** HTTP `200` with valid terminal `stop_reason` (`end_turn` or handled `stop_sequence`) divided by valid requests (excluding caller schema `400`s, **including** `400`/`429` spend limits and `5xx`s) (F1, F11, F30).
2. **Latency:** Streaming TTFT (`p50`/`p95`/`p99`) for perceived responsiveness (F7, F8), tracked separately from full turn/agent-loop duration (`p95`) so multi-tool loops do not hide slow first tokens.
3. **Behavioral & Grounding Quality:** Refusal rate (`stop_reason == "refusal"`) (F12, F19), tool failure rate (F19, F22), task success rate (`pass^k` / online evals) (F25, F26), and grounded-answer rate (citation entailment) (F10).
4. **Unit Economics & Cache Efficiency:** Cost per successful task (`USD / completed_tasks`) and prompt cache hit rate (`cache_read_input_tokens / total_input_tokens`), since cache misses simultaneously spike spend and eat uncached ITPM headroom (F23, F24).

### 2. Sample SLO Table (Illustrative Targets)

> *All targets below are **illustrative** 30-day baselines for a production RAG/tool-using Claude service; adjust for workload and traffic (F2, F9).*

| SLI | Definition | Illustrative 30d SLO | Budget | Source |
|---|---|---|---|---|
| **Completion Availability** | `200` with `end_turn`/valid termination / valid requests | `>= 99.9%` | `0.1%` | Gateway + `stop_reason` (F11) |
| **Streaming TTFT** | Request dispatch to first output token (`ttft_ms`) | `p95 <= 1,200 ms` | `5%` | OTel `ttft_ms` (F7, F20) |
| **End-to-End Latency** | Full turn or agent-loop `duration_ms` | `p95 <= 12 s` (RAG) / `<= 60 s` (agent) | `5%` | OTel root span (F20) |
| **Task Success Rate** | Sampled tasks passing outcome/calibrated-judge check | `>= 96.0%` (`pass^1`) | `4.0%` | Online eval + `session.usage` (F25, F26) |
| **Grounded-Answer Rate** | Sampled RAG answers with 100% claims cited & entailed | `>= 98.0%` | `2.0%` | Citation verifier (F10, F26) |
| **Tool Failure Rate** | `tool_result(is_error=true) / total tool_use calls` | `<= 2.0%` | `2.0%` | `claude_code.tool_result` (F19, F22) |
| **Safety Refusal Rate** | `responses(stop_reason="refusal") / total 200s` | `<= 0.5%` | `0.5%` | `stop_reason` / `api_refusal` (F12, F19) |
| **Cache Hit Rate** | `cache_read_input_tokens / total_input_tokens` | `>= 80%` | `20%` | Console / `usage` block (F23, F24) |
| **Cost / Successful Task** | `total_cost_usd / successful_tasks` | `<= $0.045` | Spend threshold | `/analytics/cost` + counter (F13, F15) |

### 3. Sample Multi-Window Alert-Routing Table (Illustrative Thresholds)

> *Burn-rate pairs (`14.4x`, `6x`, `1x`) follow Google SRE Workbook baselines for a 99.9% 30-day SLO (F5). Quality, spend, and cache thresholds are **illustrative**.*

| Condition | Trigger (Illustrative) | Long / Short Window | Route | Triage Action |
|---|---|---|---|---|
| **Fast Availability Burn** | `14.4x` (`2%` budget in 1h) | `1h` AND `5m` (F4, F5) | **Page** | Active outage (`529`, `401`, spend cap); check `request-id`. |
| **Sustained Availability Burn** | `6.0x` (`5%` budget in 6h) | `6h` AND `30m` (F4, F5) | **Page** | Sustained errors or `max_tokens` spikes; inspect recent deploys. |
| **Slow Burn** | `1.0x` (`10%` budget in 3d) | `3d` AND `6h` (F5) | **Ticket** | Gradual `ramp_limit_exceeded` bursts or tail latency creep. |
| **Spend Cap / Limit Hit** | `429 enforced_spend_limit_reached` or `400` limit | `1m` (immediate) | **Page** | Traffic blocked until cap raised or next UTC month (F30). |
| **Hourly Spend Spike** | Workspace spend `> 3x` 7d baseline (OTel or `/cost_report`) | `1h` AND `10m` | **Page** (prod) / **Ticket** (dev) | Runaway loop or key abuse; isolate by `workspace_id` / `api_key_id` (F16, F32). |
| **Refusal Spike** | `> 4x` refusal budget (e.g., `> 2%`) | `1h` AND `15m` | **Page** (customer) / **Ticket** | Serving-infra classifier change or prompt drift; check `stop_details.category` (F12, F28). |
| **Tool Failure Spike** | `> 10%` failure on a tool/MCP server | `30m` AND `5m` | **Page** (critical) / **Ticket** | MCP outage, OAuth expiry, or schema drift (`tool_name`, `error_type`) (F19). |
| **Cache Hit Drop** | `> 25 pp` drop (e.g., `85% -> <60%`) | `1h` AND `15m` | **Ticket** (**Page** if ITPM `429`s) | Prefix divergence; enable `diagnostics.previous_message_id` (F23, F24). |
| **Quality / Grounding Drift** | Calibrated online eval drops `> 3 pp` | `24h` | **Ticket** | Distribution/retrieval drift; inspect transcripts (F26). |
| **Deprecated Model Active** | `> 0` calls within 30d of retirement | `24h` | **Ticket** | Audit via Analytics `group_by[]=model`; migrate before cutoff (F29). |

### 4. Dual-Speed Telemetry & Post-Update Drift

`[INFERENCE]` Use **SDK/OTel counters** or **legacy `/cost_report` (`~5m` lag)** for real-time spend-spike paging (F16, F18), and the **Usage & Cost Analytics API (`4–24h` lag, pinned `ending_at <= data_refreshed_at`)** for reconciled chargeback across `workspace_id`, `agent_id`, `actor`, and `context_window` (F13, F14).

When diagnosing post-update drift: (1) validate intentional migrations (`4.5 -> 5.5`) with regression suites (`pass^k`) and canary `stop_reason`/token-ratio checks; (2) pin explicit model IDs (dateless `4.6+` IDs are pinned, pre-4.6 dateless IDs are rolling aliases) (F27); and (3) monitor refusal rate and sample transcripts continuously to catch serving-infrastructure shifts (routers, safety classifiers, sampling) on pinned IDs (F26, F28).

## Worked example(s)

### Python: Polling Usage/Cost Analytics safely (`data_refreshed_at` pinning) + Multi-Window Burn-Rate Check

*Status:* **Runnable structure** against `anthropic>=0.40+` (2026 Python SDK beta Analytics namespace; requires `ANTHROPIC_API_KEY` set to an Admin API key `sk-ant-admin...`). Verify exact SDK method signatures against your installed `anthropic` package version.

```python
import os
from datetime import datetime, timedelta, timezone
import anthropic

# 1) Pull reconciled cost & token telemetry from Usage and Cost Analytics API (beta)
#    Pin ending_at to data_refreshed_at from the prior run to avoid partial-bucket drift (F14).
def fetch_daily_workspace_cost(last_refreshed_iso: str | None = None) -> tuple[str | None, list[dict]]:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_ADMIN_KEY"])
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    starting_at = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    ending_at = last_refreshed_iso or now.strftime("%Y-%m-%dT%H:%M:%SZ")

    # SDK automatically sends `anthropic-beta: analytics-usage-cost-2026-08-24` (F13)
    page = client.beta.organization.analytics.cost.list(
        starting_at=starting_at,
        ending_at=ending_at,
        time_bucket_width="1d",
        group_by=["workspace_id", "model"],
        order_by="time",
        order="asc",
        limit=100,
    )

    rows = []
    refreshed_at = getattr(page, "data_refreshed_at", None)
    for row in page:
        # cost.amount is a string in USD cents with 6 decimal places (F15)
        usd = float(row.cost.amount) / 100.0
        rows.append({
            "bucket": row.starting_at,
            "workspace_id": row.group.workspace_id,
            "model": row.group.model,
            "usd": round(usd, 4),
            "requests": row.cost.requests,
        })
    return refreshed_at, rows


# 2) Multi-window, multi-burn-rate evaluator for a 99.9% 30-day LLM completion SLO (F3, F4, F5)
#    Error budget = 1 - 0.999 = 0.001.
def evaluate_slo_alerts(
    err_rate_5m: float,
    err_rate_30m: float,
    err_rate_1h: float,
    err_rate_6h: float,
    err_rate_3d: float,
    slo: float = 0.999,
) -> str:
    budget = 1.0 - slo
    # Page tier 1: 14.4x burn rate (2% budget in 1h) confirmed active in 5m (1/12 of 1h)
    if (err_rate_1h > 14.4 * budget) and (err_rate_5m > 14.4 * budget):
        return "PAGE_CRITICAL_14.4X"
    # Page tier 2: 6.0x burn rate (5% budget in 6h) confirmed active in 30m (1/12 of 6h)
    if (err_rate_6h > 6.0 * budget) and (err_rate_30m > 6.0 * budget):
        return "PAGE_HIGH_6X"
    # Ticket tier: 1.0x burn rate (10% budget in 3d) confirmed active in 6h
    if (err_rate_3d > 1.0 * budget) and (err_rate_6h > 1.0 * budget):
        return "TICKET_SLOW_BURN_1X"
    return "OK"
```

*Illustrative numeric trace:* Suppose your service has `100,000` requests/day with a `99.9%` availability SLO (`0.001` error budget). At `14:00`, a bad prompt deploy causes `max_tokens` truncations and `400` validation errors totaling `1.8%` (`0.018`) failure rate.
* Within `5–10 minutes`, `err_rate_5m` hits `0.018` (`18x` burn) and `err_rate_1h` crosses `14.4 * 0.001 = 0.0144` -> **`PAGE_CRITICAL_14.4X`** fires before 2% of the monthly budget is lost.
* At `14:15`, you roll back; `err_rate_5m` drops to `0.0005` by `14:20` -> alert **resets in 5 minutes**, even though `err_rate_1h` stays elevated for another 45 minutes (F4).

## Diagram spec

* **Type:** `flow`
* **Nodes:** `App / Agent Fleet` -> `OTel Pipeline` -> `MWMBR Alert Engine` -> (`Pager / On-Call` | `Ticket Queue`); `Anthropic Admin & Control APIs` -> `FinOps & Evals Loop` -> `App / Agent Fleet`.
* **Edges:**
  * `App / Agent Fleet` -> `OTel Pipeline`: `ttft_ms`, `gen_ai.usage.*`, `stop_reason`, `request-id`, `anthropic-workspace-id`
  * `OTel Pipeline` -> `MWMBR Alert Engine`: Yield, TTFT `p95`, refusal rate, tool failure rate, cache hit rate, hourly spend
  * `MWMBR Alert Engine` -> `Pager / On-Call`: `14.4x` (`1h/5m`) and `6x` (`6h/30m`) burn, spend-cap `400`/`429`, prod cost spike
  * `MWMBR Alert Engine` -> `Ticket Queue`: `1x` (`3d/6h`) slow burn, cache decay, quality drift, deprecation audit
  * `Anthropic Admin & Control APIs` -> `FinOps & Evals Loop`: `/analytics/cost` (pinned `data_refreshed_at`), Claude Code analytics, `diagnostics`
  * `FinOps & Evals Loop` -> `App / Agent Fleet`: Transcript-derived regression evals & pinned model/prompt rollouts
* **Caption:** *Dual-speed LLM observability combines real-time OTel SLIs and multi-window burn-rate paging with reconciled Usage and Cost Analytics API reporting and regression eval loops.*

## Exam lens

*(Editorial inference — decision patterns from the blueprint and docs, not real exam items.)*

1. **Separating HTTP errors from `stop_reason` and spend-limit failures:** HTTP `5xx` is `0%`, yet users get cut-off or refused responses. Check `stop_reason: "refusal"` (`200 OK`, logged as `claude_code.api_refusal`, not `api_error`) (F12, F19) or `max_tokens` / `model_context_window_exceeded` (F11); note self-set spend limits return `400 invalid_request_error` while tier caps return `429` with no `retry-after` (F30).
2. **MWMBR paging vs. ticketing vs. low-traffic caveats:** Fix noisy 3 AM pages and missed slow leaks using Google SRE MWMBR pairs (`1h/5m` @ `14.4x` and `6h/30m` @ `6x` -> Page; `3d/6h` @ `1x` -> Ticket) (F4, F5); for low-QPS endpoints, add synthetic traffic or widen windows (F6).
3. **Matching telemetry APIs to latency requirements:** Never page in real time off `/v1/organizations/analytics/cost` (`4–24h` lag, 7-day month-end reconciliation) (F14); use OTel counters or legacy `/cost_report` (`~5m` lag) for rapid spike detection (F16, F18), and pin `ending_at <= data_refreshed_at` on the Analytics API for FinOps reports (F14).
4. **Distinguishing cache invalidation from model/infra drift:** Sudden token-cost doubling plus `429`s without traffic growth indicates cache-prefix invalidation (`cache_read_input_tokens -> 0`, eating uncached ITPM; check `diagnostics.previous_message_id`) (F23, F24). Subtle refusal/style shifts on a pinned `4.6+` ID point to serving-infrastructure changes rather than weight updates (F27, F28).

## Common mistakes

* **Alerting solely on HTTP `4xx`/`5xx`:** Misses `stop_reason: "refusal"`, `max_tokens` truncation, and failing tool loops that return HTTP `200` (F11, F12).
* **Paging in real time on `/v1/organizations/analytics/cost`:** Its `4h–24h` lag misses runaway loops, and unpinned queries shift during the 7-day month-end reconciliation window (F14).
* **Treating `claude-sonnet-4-6` or `claude-sonnet-5` as rolling aliases:** `4.6+` dateless IDs are pinned snapshots; weights stay frozen, though serving infra (classifiers/routers) can still shift (F27, F28).
* **Separating cache hit rate from rate-limit monitoring:** Because `cache_read_input_tokens` are exempt from ITPM and ramp limits, prefix cache misses simultaneously spike spend and trigger ITPM `429`s (F23, F24).
* **Using `for: 1h` durations or single-window SLO alerts:** Fixed durations delay `100%` outage pages and miss oscillating spikes; single long windows stay firing long after recovery (F4, F5).
* **Setting OTel env vars in repo `.claude/settings.json`:** Claude Code ignores exporter vars in project/local settings (F18), and `OTEL_LOG_USER_PROMPTS=1` / `OTEL_LOG_TOOL_CONTENT=1` must stay disabled under strict privacy/ZDR rules (F20).

## Self-check

1. **Q:** HTTP `5xx` is `0%`, yet users get truncated/refused answers and ITPM `429`s just jumped `4x`. Which two `200`-level signals do you check?
   **A:** `stop_reason` (`"refusal"`, `"max_tokens"`, `"model_context_window_exceeded"`) for silent quality/policy failures (F11, F12), and `usage.cache_read_input_tokens` (plus `diagnostics.previous_message_id`) because cache misses convert reads into uncached ITPM usage (F23, F24).
2. **Q:** Why does Google SRE's MWMBR rule require `err_rate_1h > 14.4 * budget AND err_rate_5m > 14.4 * budget`?
   **A:** The `1h` window ensures precision (`2%` budget spent), while the `5m` (`1/12`) window confirms active burn so the alert clears within `5m` after rollback (F4, F5).
3. **Q:** Which spend limit returns `429 enforced_spend_limit_reached` (no `retry-after`), which returns `400 invalid_request_error`, and which API manages Enterprise per-user limits?
   **A:** Monthly tier caps return `429` (`enforced_spend_limit_reached`, no `retry-after`); self-set org/workspace limits return `400 invalid_request_error` (Claude Code workspaces may return `429`) (F30); the Spend Limits API manages Enterprise per-user limits (F33).

## Unresolved

* **Native grounded-answer metric:** Anthropic provides no built-in server-side groundedness score in Analytics or Messages responses; grounded-answer rate must be measured via application-side citation/entailment checks (F10, F26).
* **Claude API server-side TTFT span attribute:** Claude Code OTel documents `ttft_ms` and `first_content_ms` on `claude_code.llm_request` spans (F20), whereas the inspected Claude API span reference did not list `ttft_ms`; derive API TTFT from streaming `content_block_delta` timestamps on SDK spans.
