# 3.1 Telemetry and Instrumentation

Applying instrumentation practice to production Claude systems under debuggability and privacy requirements, including distributed traces for agent loops and tool calls, token and cost metrics, cache-performance diagnostics, grounding and reasoning traceability, structured log events, and content-capture configuration under privacy constraints such as zero-data-retention.

## Scope map

- Distributed traces for agent loops and tool calls → Core facts; Exact API / config details; Practitioner reasoning; Worked example; Diagram spec.
- Token and cost metrics → Core facts; Exact API / config details; Practitioner reasoning; Worked example.
- Cache-performance diagnostics → Core facts; Exact API / config details; Practitioner reasoning; Worked example.
- Grounding and reasoning traceability → Core facts; Exact API / config details; Practitioner reasoning.
- Structured log events → Core facts; Exact API / config details; Practitioner reasoning.
- Content-capture configuration under privacy constraints such as zero-data-retention → Core facts; Exact API / config details; Practitioner reasoning; Exam lens; Common mistakes.

## Core facts

- OpenTelemetry separates observability into traces (request paths across nested spans), metrics (runtime measurements with metadata), and logs; when an OTel SDK or autoinstrumentation is active, emitted log records automatically carry the active `trace_id` and `span_id` for correlation. (F1)
- OpenTelemetry GenAI semantic conventions (`gen_ai.*`) are in **Development** stability rather than Stable; spans model logical operations as observed by the caller, including automatic retries, and capture `gen_ai.operation.name` (`chat`, `execute_tool`, `invoke_agent`) and `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`. (F2) (F3)
- Anthropic provides beta first-party OpenTelemetry tracing for both the Anthropic SDK (`CLIENT` and `INTERNAL` spans) and the Claude API / Managed Agents (`SERVER` and `INTERNAL` spans, configured via Console destinations or `/v1/organizations/telemetry_destinations`), adopting `gen_ai.*` conventions alongside `anthropic.*` attributes. (F4) (F6)
- When both SDK and API tracing are enabled for a Messages API call, both emit a span named `anthropic.messages.create`; sum **only** the API `SERVER` spans (never both) for token accounting, and do not add `gen_ai.usage.cache_read.input_tokens` or `gen_ai.usage.cache_write.input_tokens` onto `gen_ai.usage.input_tokens`, because on Anthropic OTel spans `gen_ai.usage.input_tokens` already includes cache reads and writes. (F6) (F7)
- API-side OTel spans report billed token counts even on failed or client-canceled requests, whereas client SDK spans reflect only response-reported counts (which can be lower or absent on failure/cancellation). (F12)
- In the Messages API `usage` JSON object (and streaming `message_start` / `message_delta`), `usage.input_tokens` reports **only** uncached tokens after the last cache breakpoint; total input tokens equal `cache_read_input_tokens + cache_creation_input_tokens + input_tokens`, and `cache_creation_input_tokens` equals `cache_creation.ephemeral_5m_input_tokens + cache_creation.ephemeral_1h_input_tokens`. (F23) (F24)
- Cache diagnostics (`diagnostics: {"previous_message_id": ...}` on `/v1/messages`) stores lightweight hash-and-token-estimate fingerprints (never raw prompt text) to report the earliest prefix divergence (`model_changed`, `system_changed`, `tools_changed`, `messages_changed`), which combined with `usage.cache_read_input_tokens` separates prefix mutations from cache TTL expiry or sub-minimum prompt length. (F25) (F26)
- Every Claude API response carries a `request-id` header (`req_...`) and error responses mirror it in JSON `request_id` for log correlation and Anthropic support; SDKs expose it as `_request_id` (Python/TypeScript) or raw-response accessors. (F27)
- For organization-wide financial reconciliation and attribution, the beta Usage and Cost Analytics API (`/v1/organizations/analytics/usage` and `/cost`, header `anthropic-beta: analytics-usage-cost-2026-08-24`) unifies Console and Enterprise reporting, refreshing typically within 4 hours (up to 24h) and finalizing ~7 days after month-end; the legacy `/v1/organizations/usage_report/messages` and `/cost_report` endpoints remain supported. (F28) (F29) (F30)
- Claude Code exports OTel metrics, structured log events, and beta distributed traces (`CLAUDE_CODE_ENABLE_TELEMETRY=1`, plus `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` for traces); all prompt text, assistant responses, tool arguments, and tool outputs are redacted by default unless explicitly opted in. (F13) (F14) (F17)
- In Claude Code, model refusals (`stop_reason: "refusal"`) arrive on a 200 response stream rather than an HTTP error, so they emit `claude_code.api_refusal` instead of `claude_code.api_error`. (F18)
- The Claude Agent SDK delegates OTel export to its Claude Code CLI child process: Python `ClaudeAgentOptions.env` merges onto inherited env vars while TypeScript `options.env` replaces them (`...process.env` required), the `console` exporter must never be used (stdout is the SDK message channel), export errors fail silently unless `CLAUDE_CODE_OTEL_DIAG_STDERR=1` is set, and `ResultMessage.model_usage` (`modelUsage`)—not `usage`—must be read when subagents run. (F19) (F20) (F21) (F22)
- Grounding and reasoning traceability rely on `citations` blocks (`char_location`, `page_location`, `content_block_location`, incompatible with `output_config.format` which returns HTTP 400) and `thinking` blocks (carrying an encrypted `signature` verified on round-trip) plus `redacted_thinking` blocks (opaque encrypted `data` when reasoning is safety-redacted). (F31) (F32) (F33)
- Trace propagation across agent → subagent → MCP tool calls uses W3C Trace Context (`traceparent`, `tracestate`): API server spans drop traces when the `sampled` flag is off, Agent SDK/`-p` runs honor inbound `TRACEPARENT`/`TRACESTATE` (interactive CLI ignores them), and MCP `2026-07-28` reserves unprefixed `traceparent`, `tracestate`, and `baggage` in `params._meta`, which Anthropic's MCP connector populates from `anthropic.mcp_tool_use`. (F9) (F10) (F15) (F16) (F35)
- Under Zero Data Retention (ZDR), Anthropic does not store prompts or responses at rest (Messages API full-content OTel spans are held in memory only until delivered), but ZDR does **not** block non-eligible stateful features (Files, Batch, Code Execution, MCP Connector, Managed Agents)—invoking them steps outside ZDR for that data, and Covered Models (Fable/Mythos 5.x) require 30-day retention; any content captured in your own OTel backend is governed by that backend's retention policy. (F8) (F34)

## Exact API / config details

### OpenTelemetry & GenAI Semantic Conventions
- **GenAI span attributes** (`gen_ai.*`, Development status): `gen_ai.operation.name` (`chat`, `execute_tool`, `invoke_agent`), `gen_ai.provider.name` (`anthropic`), `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.response.id`, `gen_ai.response.finish_reasons`, `gen_ai.conversation.id`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.cache_write.input_tokens`; `error.type` is Stable (`rate_limit_error`, HTTP status, `connection_error`, `client_timeout_error`, `api_error`). (F2) (F3)
- **Anthropic SDK & API span names**:
  - `anthropic.messages.create` (`CLIENT` from SDK, `SERVER` from API; `gen_ai.operation.name = "chat"`). (F6)
  - `anthropic.messages.tool_runner` (`INTERNAL`, SDK loop span), `anthropic.model_request` (`INTERNAL`, per-model-call API span), `anthropic.compaction` (`INTERNAL`). (F6)
  - `anthropic.tool_use <tool>` (server/agent tools), `anthropic.mcp_tool_use <tool>` (MCP connector / SDK MCP helper), `anthropic.custom_tool_use <tool>` (client tool runner). (F10)
- **Anthropic SDK OTel options & env vars**:
  - `open_telemetry={"tracer_provider": ..., "traces": {"content_mode": "metadata_only" | "content", "max_content_bytes": ...}, "conversation_id": ..., "propagation": True | False}` (passing `open_telemetry` overrides all `ANTHROPIC_OPEN_TELEMETRY*` env vars as a whole). (F4) (F5) (F11)
  - Env vars: `ANTHROPIC_OPEN_TELEMETRY=false`, `ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE=content` (default `metadata_only`), `ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES` (default `0.75 MB`), `ANTHROPIC_OPEN_TELEMETRY_PROPAGATION=false`. (F4) (F5) (F11)
- **API OTel destinations**: Console **OpenTelemetry settings** or `POST /v1/organizations/telemetry_destinations` (`anthropic-beta: telemetry-destinations-2026-08-11`), HTTPS OTLP/HTTP protobuf on port `443`, gzip-compressed (falls back on `400`/`406`/`415`/`422`), 10 destinations/org max, disabled on `3xx` redirect or 24h continuous failure. (F8) (F9)

### Claude Code & Agent SDK OpenTelemetry
- **Core switches**: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER` (`otlp`, `prometheus`, `console`, `none`), `OTEL_LOGS_EXPORTER` (`otlp`, `console`, `none`), `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` + `OTEL_TRACES_EXPORTER` (`otlp`, `console`, `none`). Never set `console` inside Agent SDK. (F13) (F20)
- **Transport & intervals**: `OTEL_EXPORTER_OTLP_PROTOCOL` (`grpc`, `http/json`, `http/protobuf`), `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_METRIC_EXPORT_INTERVAL` (default `60000` ms), `OTEL_LOGS_EXPORT_INTERVAL` (`5000` ms), `OTEL_TRACES_EXPORT_INTERVAL` (`5000` ms); `CLAUDE_CODE_OTEL_DIAG_STDERR=1` to surface export failures in Agent SDK `stderr`. (F13) (F21)
- **Content-capture & cardinality flags** (all content flags off by default):
  - `OTEL_LOG_USER_PROMPTS=1` (prompt text; also controls `assistant_response` if `OTEL_LOG_ASSISTANT_RESPONSES` is unset—set `OTEL_LOG_ASSISTANT_RESPONSES=0` to log prompts without responses). (F14)
  - `OTEL_LOG_TOOL_DETAILS=1` (tool parameters/arguments, Bash commands, real `agent.name`/`skill.name`/`plugin.name`/`mcp_server.name`/`mcp_tool.name` instead of `"custom"`/`"third-party"`). (F14)
  - `OTEL_LOG_TOOL_CONTENT=1` (`tool.output` span event up to `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH`, default 60 KB). (F14)
  - `OTEL_LOG_RAW_API_BODIES=1` or `file:<dir>` (full request/response JSON with extended thinking always redacted). (F17)
  - Cardinality/identity: `OTEL_METRICS_INCLUDE_SESSION_ID` (`true`), `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (`true`), `OTEL_METRICS_INCLUDE_VERSION` (`false`), `OTEL_METRICS_INCLUDE_ENTRYPOINT` (`false`), `OTEL_METRICS_INCLUDE_REPOSITORY` (`false`), `OTEL_RESOURCE_INCLUDE_HOST=1` (`host.name`, `host.id`). (F14)
- **Metrics**: `claude_code.session.count`, `claude_code.lines_of_code.count`, `claude_code.pull_request.count`, `claude_code.commit.count`, `claude_code.cost.usage` (`USD`), `claude_code.token.usage` (`tokens`), `claude_code.code_edit_tool.decision`, `claude_code.active_time.total` (`s`). (F13)
- **Log events**: `claude_code.user_prompt`, `claude_code.assistant_response`, `claude_code.tool_result`, `claude_code.tool_decision`, `claude_code.api_request`, `claude_code.api_error`, `claude_code.api_refusal`, `claude_code.api_request_body`, `claude_code.api_response_body`, `claude_code.subagent_completed`, `claude_code.compaction`. (F14) (F18)
- **Trace propagation**: `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` forces outbound `traceparent` when using a custom `ANTHROPIC_BASE_URL` proxy; Agent SDK auto-injects `TRACEPARENT`/`TRACESTATE` unless explicitly set in `options.env`, and forwards `TRACEPARENT` to Bash/PowerShell subprocesses. (F15) (F16) (F19)

### Messages API Usage, Cache Diagnostics, Correlation, and Admin Analytics
- **Messages `usage` fields**: `input_tokens` (uncached post-breakpoint only), `output_tokens` (includes thinking tokens), `cache_creation_input_tokens`, `cache_read_input_tokens`, `cache_creation: {ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}`, `server_tool_use: {web_search_requests, ...}`. (F23) (F24)
- **Cache diagnostics (`/v1/messages`)**: send `diagnostics: {"previous_message_id": None | prev_response.id}`; response `diagnostics.cache_miss_reason.type` is `model_changed`, `system_changed`, `tools_changed`, `messages_changed`, `previous_message_not_found`, or `unavailable` (plus `cache_missed_input_tokens` byte-derived estimate). `diagnostics: null` means no divergence (or first turn); `{"cache_miss_reason": null}` means comparison still pending. (F25) (F26)
- **Correlation headers**: `request-id` (`req_...`, SDK `_request_id`); on Claude Platform on AWS, `x-amzn-requestid` (CloudTrail) + `request-id` (Anthropic support); `anthropic-workspace-id` confirms shared workspace for `previous_message_id`. (F27)
- **Usage & Cost Analytics API (beta)**: `GET /v1/organizations/analytics/usage` and `GET /v1/organizations/analytics/cost` with `anthropic-beta: analytics-usage-cost-2026-08-24` and `anthropic-version`; supports `time_bucket_width` (`1m`, `1h`, `1d`), `group_by[]`, `data_refreshed_at` watermark, Admin key / `org:admin` OAuth / WIF (Console) or `read:analytics` (Enterprise). Legacy endpoints: `GET /v1/organizations/usage_report/messages` and `/v1/organizations/cost_report` (`1d` only, USD cents, omits Priority Tier). (F28) (F29) (F30)

### Grounding, Thinking, and ZDR Feature Matrix
- **Citations**: `citations: {"enabled": True}` on `document` blocks returns `char_location`, `page_location`, `content_block_location`; incompatible with `output_config.format` (HTTP `400`). (F31)
- **Thinking**: `thinking` blocks carry `thinking` (empty string when `display: "omitted"`) and encrypted `signature`; safety-redacted reasoning returns `redacted_thinking` with encrypted `data`. Both must be preserved verbatim in tool-use multi-turn loops. (F32) (F33)
- **ZDR eligibility** (`platform.claude.com/docs/en/manage-claude/api-and-data-retention`):
  - *Eligible*: Messages API, Token Counting, Prompt Caching (in-memory KV/hashes for TTL), Cache Diagnostics (`Yes (qualified)`), Citations, Thinking, Web Search/Fetch (excluding dynamic filtering), client-side tools, OTel API tracing (content held in memory until delivered). (F8) (F34)
  - *Not eligible* (not blocked by API under ZDR—calling them exits ZDR for that data): Files API, Batch API (29d retention), Code Execution / Programmatic Tool Calling (30d), Agent Skills, MCP Connector, Managed Agents (except self-hosted), Covered Models (Fable 5/5.1/5.2, Mythos 5/5.1/5.2 — 30d retention). (F34)

## Practitioner reasoning

- **[INFERENCE] Two-plane telemetry separation (structural vs. content):** Treat structural telemetry (`metadata_only`, latency, `stop_reason`, `request-id`, `trace_id`, token counts, `cache_miss_reason.type`) as always-on in production, and treat content capture (`content` mode, `OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_TOOL_DETAILS=1`, `OTEL_LOG_TOOL_CONTENT=1`) as gated behind workspace/environment policy and collector scrubbing. Even when Anthropic operates under ZDR, exporting `Full content` spans to an external observability vendor replicates raw prompts and PII into that vendor's storage under its own retention SLA. (F4) (F8) (F14)
- **[INFERENCE] Choosing the right token/cost source of truth:** Use Messages `usage` / OTel `anthropic.messages.create` `SERVER` spans for real-time per-request debugging and latency/cache correlation; use `ResultMessage.model_usage` for in-process Agent SDK loop totals (to avoid missing subagents); and use the Usage & Cost Analytics API (querying `ending_at <= data_refreshed_at`, and re-querying after 7 days post-month-end) for authoritative billing reconciliation, since client-side `total_cost_usd` uses a bundled pricing table and OTel span delivery is best-effort/samplable. (F6) (F12) (F22) (F29)
- **[INFERENCE] Diagnosing cache drops systematically:** Compute per-turn cache hit ratio as `cache_read_input_tokens / (cache_read_input_tokens + cache_creation_input_tokens + input_tokens)`. When it drops unexpectedly, inspect `diagnostics.cache_miss_reason`: a `*_changed` reason points to prefix mutation (e.g., timestamp in `system`, unsorted `tools` keys, modified history, or model fallback switch), whereas `diagnostics: null` with zero `cache_read_input_tokens` points to TTL expiration (>5m or >1h gap) or a prefix below minimum cacheable token length. (F23) (F26)
- **[INFERENCE] Preserving trace continuity across heterogeneous hops:** In multi-process agent stacks (FastAPI → Agent SDK subprocess → Bash/Python script or remote MCP server), broken traces usually stem from three failure modes: (1) TypeScript `options.env` overwriting `process.env` and dropping `TRACEPARENT`/auth, (2) a custom `ANTHROPIC_BASE_URL` proxy stripping or blocking outbound `traceparent` without `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1`, or (3) local `stdio` MCP servers lacking HTTP headers and therefore requiring `params._meta.traceparent` extraction. (F10) (F15) (F19) (F35)

## Worked example

A customer-support backend runs a multi-turn agent loop using the Anthropic Python SDK (`anthropic` with OpenTelemetry tracing enabled in `metadata_only` mode to preserve ZDR boundaries) and `diagnostics` enabled to catch cache regressions after deploying a new tool registry.

**Concrete numbers (Turn 2 regression detected):**
- Turn 1 (`id="msg_01A..."`, `request-id="req_019X..."`): `cache_read=0`, `cache_creation=18400`, `input_tokens=120` → total input = `18,520`, hit ratio = `0%` (cold write).
- Turn 2 (`previous_message_id="msg_01A..."`): `cache_read=0`, `cache_creation=18400`, `input_tokens=145`, `diagnostics.cache_miss_reason={"type": "tools_changed", "cache_missed_input_tokens": 18500}` → hit ratio = `0%` instead of expected `~99.2%` (`18400 / 18545`). Root cause: non-deterministic dict iteration reordered `tools` JSON between turns.

**Illustrative Python code (based on documented `anthropic` beta `messages` + `opentelemetry-sdk` APIs; requires live API key and OTLP collector):**

```python
import logging
from anthropic import Anthropic
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

# 1. Configure OTel tracer provider before creating Anthropic client
provider = TracerProvider()
provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="http://collector.internal:4318/v1/traces"))
)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("support-agent")
logger = logging.getLogger("support-agent")

# 2. Enforce ZDR-safe metadata_only mode explicitly (overrides ANTHROPIC_OPEN_TELEMETRY* env vars)
client = Anthropic(
    open_telemetry={"tracer_provider": provider, "traces": {"content_mode": "metadata_only"}}
)

def run_turn(messages: list[dict], prev_msg_id: str | None) -> tuple[object, dict]:
    with tracer.start_as_current_span("agent.turn") as span:
        resp = client.beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=1024,
            cache_control={"type": "ephemeral"},
            system="You are a concise support agent.",
            messages=messages,
            diagnostics={"previous_message_id": prev_msg_id},
        )
        u = resp.usage
        total_in = u.input_tokens + (u.cache_read_input_tokens or 0) + (u.cache_creation_input_tokens or 0)
        hit_ratio = (u.cache_read_input_tokens or 0) / total_in if total_in else 0.0

        # Attach structural correlation & cache diagnostics without logging prompt text
        span.set_attribute("anthropic.request_id", resp._request_id)
        span.set_attribute("cache.hit_ratio", round(hit_ratio, 4))
        miss_type = resp.diagnostics.cache_miss_reason.type if (resp.diagnostics and resp.diagnostics.cache_miss_reason) else "none"
        span.set_attribute("cache.miss_reason", miss_type)

        logger.info(
            "turn_complete request_id=%s msg_id=%s hit_ratio=%.4f miss_reason=%s",
            resp._request_id, resp.id, hit_ratio, miss_type,
        )
        return resp, {"total_input_tokens": total_in, "hit_ratio": hit_ratio, "miss_type": miss_type}
```

## Diagram spec

- **Type:** `tree`
- **Nodes and edges:**
  - `POST /support/chat` (`service.name=api-gateway`, `trace_id=4bf92f3577b34da6a3ce929d0e0e4736`, `duration=2840ms`)
    - `claude_code.interaction` (`service.name=support-triage-agent`, parented via `TRACEPARENT`, `duration=2790ms`, `interaction.sequence=1`, `parent.source=env`, `user_prompt=<REDACTED>`)
      - `claude_code.llm_request` (`kind=CLIENT`, `duration=820ms`, `gen_ai.system=anthropic`, `gen_ai.request.model=claude-sonnet-5`, `request_id=req_019X...`, `stop_reason=tool_use`)
        - `anthropic.messages.create` (`service.name=claude-platform`, `kind=SERVER`, `duration=790ms`, `gen_ai.operation.name=chat`, `gen_ai.usage.input_tokens=18520`, `gen_ai.usage.cache_read.input_tokens=18400`, `gen_ai.usage.output_tokens=195`)
      - `claude_code.tool` (`tool_name=Agent`, `duration=1410ms`)
        - `claude_code.llm_request` (`agent_id=sub_01`, `parent_agent_id=main`, `query_source_safe=agent.builtin.general-purpose`, `duration=610ms`)
        - `claude_code.tool` (`tool_name=mcp__orders__get_order`, `duration=740ms`)
          - `anthropic.mcp_tool_use get_order` (`kind=INTERNAL`, injects `params._meta.traceparent`)
            - `mcp.tools.call get_order` (`service.name=orders-mcp-server`, `kind=SERVER`, `duration=690ms`, `gen_ai.operation.name=execute_tool`)
      - `claude_code.llm_request` (`kind=CLIENT`, `duration=520ms`, `stop_reason=end_turn`, `ttft_ms=180`)
- **Caption:** End-to-end distributed trace tree linking an application HTTP request through an Agent SDK `claude_code.interaction` span, Claude API `SERVER` model spans, a nested subagent, and a remote MCP `tools/call` server span propagated via W3C `traceparent` and `params._meta`.

## Exam lens

*(Editorial inference — decision patterns derived from the blueprint and documented mechanics)*

1. **Privacy boundary vs. debuggability configuration:** Given a ZDR-regulated workload experiencing intermittent tool failures, select structural telemetry (`metadata_only`, `request-id`, `cache_miss_reason`, `CLAUDE_CODE_ENABLE_TELEMETRY=1` with `OTEL_LOG_USER_PROMPTS` and `OTEL_LOG_TOOL_CONTENT` unset) over `Full content` export—and recognize that calling non-eligible stateful features (Batch, Files, Managed Agents, MCP Connector) silently steps outside ZDR without an API 400 error.
2. **Token and cost accounting reconciliation:** When asked why OTel dashboard token totals are ~2x higher than the Usage & Cost Analytics API or why Agent SDK `ResultMessage.usage` is lower than `model_usage`, identify double-counting of SDK `CLIENT` + API `SERVER` spans, adding `cache_read` onto `gen_ai.usage.input_tokens`, or `ResultMessage.usage` omitting subagent tokens.
3. **Cache drop root-cause isolation:** Given `cache_read_input_tokens = 0` on turn 2, use `diagnostics.cache_miss_reason` combined with `usage` to differentiate prefix drift (`tools_changed`, `system_changed`, `model_changed`) from TTL expiration or workspace mismatch (`previous_message_not_found`, verify `anthropic-workspace-id`).
4. **Cross-boundary trace breakage:** Diagnose missing child spans across Agent SDK → Claude API → MCP server: check whether TypeScript `options.env` dropped `process.env`, whether `traceparent` had the sampled flag `00` (causing API spans to be omitted), whether `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` is needed behind a custom `ANTHROPIC_BASE_URL` proxy, or whether an MCP server failed to extract `params._meta.traceparent`.

## Common mistakes

- **Double-counting cached tokens in OTel vs. Messages API:** In the Messages API JSON response, `usage.input_tokens` excludes cache reads and writes (`total = input + cache_read + cache_creation`); in Anthropic OTel spans, `gen_ai.usage.input_tokens` **already includes** `cache_read` and `cache_write`. Applying the Messages API sum formula to OTel spans double-counts cached tokens. (F7) (F23)
- **Summing both SDK `CLIENT` and API `SERVER` spans:** Enabling both SDK and API tracing produces two `anthropic.messages.create` spans per request; sum only the `SERVER` spans. (F6)
- **Assuming ZDR covers your observability vendor or blocks non-ZDR features:** ZDR governs Anthropic's storage at rest; exporting `Full content` spans sends prompts to your OTel vendor's storage, and calling non-ZDR endpoints (Batch, Files, MCP Connector) does not fail with a 400—it simply falls outside ZDR. (F8) (F34)
- **Using `OTEL_METRICS_EXPORTER=console` (or `OTEL_TRACES_EXPORTER=console`) in the Agent SDK:** Writing telemetry to stdout corrupts the SDK's JSON message pipe. (F20)
- **Reading `ResultMessage.usage` for subagent-heavy runs:** `usage` excludes subagent loops; read `model_usage` (`modelUsage`) or `total_cost_usd` instead. (F22)
- **Combining `citations` with `output_config.format`:** The API rejects structured JSON outputs when document citations are enabled with HTTP `400`. (F31)
- **Stripping or altering `thinking` signatures or `redacted_thinking` blocks:** Modifying or dropping them in multi-turn tool-use loops breaks server verification (`400`). (F32) (F33)

## Self-check

1. **You enable both Anthropic SDK OTel tracing and API OTel tracing, and your billing alert fires at 2x expected input tokens. What two telemetry aggregation bugs most likely caused this?**
   *Answer:* Summing both `CLIENT` and `SERVER` `anthropic.messages.create` spans for the same request, and/or adding `gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.cache_write.input_tokens` onto `gen_ai.usage.input_tokens` (which already includes them on Anthropic OTel spans). (F6) (F7)
2. **A ZDR-enabled team sets `OTEL_TRACES_EXPORTER=otlp` in a TypeScript Agent SDK worker via `options: { env: { CLAUDE_CODE_ENABLE_TELEMETRY: "1", ... } }`, and calls suddenly fail with auth errors while no telemetry errors appear in app logs. Why?**
   *Answer:* In TypeScript, `options.env` replaces `process.env` completely, stripping `ANTHROPIC_API_KEY` and `PATH` unless `...process.env` is spread; additionally, the CLI drops OTel export errors silently unless `CLAUDE_CODE_OTEL_DIAG_STDERR=1` is set and the `stderr` callback is wired. (F19) (F21)
3. **Turn 5 of a cached conversation reports `cache_read_input_tokens: 0` and `diagnostics: null`. Did the prompt prefix change?**
   *Answer:* No—`diagnostics: null` (after passing a valid `previous_message_id`) indicates no structural divergence before the breakpoint. Combined with `cache_read_input_tokens: 0`, it indicates the cache entry expired (exceeded the 5m or 1h TTL) or the prefix is shorter than the minimum cacheable token length. (F26)

## Unresolved

- **Citation location variants beyond `citations.md`:** `char_location`, `page_location`, and `content_block_location` were verified directly in `citations.md`; `web_search_result_location` and `search_result_location` schemas on the search-results/web-search pages were not extracted verbatim here.
- **Beta schema stability:** Anthropic's OpenTelemetry export (`platform.claude.com/docs/en/manage-claude/opentelemetry`), Claude Code distributed tracing (`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`), and the Usage and Cost Analytics API (`analytics-usage-cost-2026-08-24`) are all documented as beta as of 2026-11-19, and OpenTelemetry GenAI semantic conventions remain at `Development` stability.
