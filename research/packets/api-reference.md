# Appendix: Messages API and Tool-Use Quick Reference

> Code-ready quick reference for the Claude Messages API (`POST /v1/messages`), request/response schemas, content blocks, tool-use protocol, strict structured outputs, SSE streaming, usage accounting, stop reasons vs. HTTP errors, current model IDs/limits, and beta headers as of `2026-11-19` (`anthropic-version: 2026-10-21`).

## Appendix outline

- Messages API request/response shape & headers → Core facts; Exact API / config details §1–2.
- Content block types (`text`, `image`, `document`, `tool_use`, `tool_result`, `server_tool_use`, `web_search_tool_result`, `thinking`, `redacted_thinking`, `search_result`) → Core facts; Exact API / config details §3.
- Tool-use turn rules, `tool_result` ordering, parallel & mixed tool calls → Core facts; Exact API / config details §4; Worked example; Diagram spec.
- JSON Schema `input_schema`, strict tool use (`strict: true`), and structured outputs (`output_config.format` / `output_format`) → Core facts; Exact API / config details §5; Common mistakes.
- Streaming SSE event sequence, delta types, and cumulative `usage` → Core facts; Exact API / config details §6; Worked example; Diagram spec.
- Usage accounting, `stop_reason` values vs. HTTP errors → Core facts; Exact API / config details §7–8.
- Current model IDs, aliases, context windows, max output, and beta headers → Core facts; Exact API / config details §9–10.

## Core facts

- `POST /v1/messages` is stateless and handles both single-turn queries and multi-turn conversations (F1). Official SDKs inject authentication, `anthropic-version`, and `content-type` headers automatically, while `anthropic-workspace-id` is supplied by the caller when using an org-wide key (F2).
- First-party Messages API requests cap at 128 MB (returning HTTP 413 `request_too_large` when exceeded); Anthropic-operated cloud platforms cap at 32 MB, Google-managed Vertex at 30 MB, and Amazon Bedrock at 20 MB (F3).
- Under `anthropic-version: 2026-10-21`, `temperature`, `top_p`, and `top_k` are removed and return a `400` error on every model (F4). Placing a `document` block in an `assistant` message or non-empty `citations` in a `user` message also returns `400` (F4).
- `max_tokens` is a hard ceiling covering both thinking and visible output tokens; setting `max_tokens: 0` warms the prompt cache without generating output (F5). Official SDKs reject non-streaming calls with `max_tokens > 21333` client-side to avoid HTTP timeouts (F6).
- `messages` must alternate `user` and `assistant` turns (consecutive same-role turns are merged) (F7). Claude 4.6+ models and Mythos Preview reject assistant prefill with `400` (F8). `metadata.user_id` accepts an opaque identifier up to 512 chars and must exclude PII (F9).
- `tool_choice` defaults to `auto` when `tools` is non-empty; `disable_parallel_tool_use: true` sits inside `tool_choice`, not at the top level (F10). Forced tool use (`any` or `tool`) fails with `400` under manual extended thinking and unconditionally on Opus 5.5, Sonnet 5.5, Fable 5.1/5.2, and Mythos 5.1/5.2 (F11).
- `thinking.display` (`summarized`, `omitted`, or beta `updates`) controls returned reasoning text without changing billing (F12). `output_config.effort` defaults to `medium` on Opus 5.5 and Haiku 5.5 and `high` on other effort-capable models (F13).
- Images support `jpeg`, `png`, `gif`, and `webp` up to 8000×8000 px, flattening animations to frame 1 (F14); exceeding 20 images (including history and `tool_result` images) triggers a stricter per-image pixel cap (F15). PDFs allow up to 600 pages (100 on 200K-context models) (F16). `search_result` blocks accept only `text` blocks in `content` (F17).
- Both `thinking` (with `signature`) and `redacted_thinking` (with `data`) blocks must be echoed unmodified in tool-use turns (F18).
- `tool_result` blocks must go in a `user` message immediately after the assistant `tool_use` message (F19), ordered **before** any `text` blocks (F20). Parallel tool calls require one matching `tool_result` per `tool_use_id` in that single `user` message (F21). If the turn also contains an unresolved `server_tool_use`, the `user` message must contain **only** `tool_result` blocks with no trailing text (F22).
- Server web search failures return HTTP `200` with a `web_search_tool_result_error` payload; `encrypted_content` in `web_search_result` must be echoed verbatim in multi-turn history (F23).
- Tool names must match `^[a-zA-Z0-9_-]{1,128}$` (F24). Structured outputs use `output_config.format` (no beta header); deprecated `output_format` requires `structured-outputs-2025-11-13` (F25).
- Grammar-constrained outputs emit required properties before optional ones (F26), enforce request-wide complexity caps (20 strict tools, 24 optional parameters, 16 union-type parameters, 180 s compile timeout) (F27), do not guarantee enum string capitalization, and can still break the schema on `refusal` or `max_tokens` (F28).
- SSE streams emit `message_start` → per-block `content_block_start` / `content_block_delta` / `content_block_stop` → `message_delta` → `message_stop` (plus `ping` and `error`); `redacted_thinking` and `web_search_tool_result` arrive whole with no deltas (F29). Tool inputs stream as `input_json_delta` `partial_json` strings (F30), and `eager_input_streaming: true` can emit invalid or truncated JSON (F31).
- `message_delta.usage` counts are cumulative (F32). Total input tokens equal `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` (F33). `stop_reason` is `null` in `message_start` and populated in `message_delta` (F34).
- Official SDKs retry transient errors (`429`, `5xx`, connection failures) twice by default with backoff honoring `retry-after` (F35).
- From Claude 4.6 onward, dateless model IDs are pinned snapshots (not rolling aliases) (F36) with 1M context windows and 128K max output (up to 300K on Batches API with `output-300k-2026-03-24`) (F37).
- Multiple beta flags can be comma-separated in one `anthropic-beta` header (required for Google-managed Vertex, which ignores extra `anthropic-beta` headers) (F38).
- Prompt caching hashes the prefix in strict order: `tools` → `system` → `messages` up to each `cache_control` breakpoint (F39). Fast mode (`speed: "fast"`) is GA on Opus 5.5 and Fable/Mythos 5.2, requiring `fast-mode-2026-02-01` only on Opus 5 and Opus 4.8 (F40).

## Exact API / config details

### 1. Endpoint, Headers, and Transport Limits

- **Endpoint:** `POST https://api.anthropic.com/v1/messages` (F1).
- **Request headers:**
  - `Authorization: Bearer <api_key_or_wif_token>` (preferred) or `x-api-key: <api_key>` (legacy fallback) (F2).
  - `anthropic-version: 2026-10-21` (required; SDKs inject automatically) (F2, F4).
  - `content-type: application/json` (required) (F2).
  - `anthropic-workspace-id: wrkspc_...` (required for org-level keys not scoped to one workspace; absent/unused on Workload Identity Federation tokens) (F2).
  - `anthropic-user-profile-id` (optional end-user attribution header).
  - `anthropic-beta: <flag1>,<flag2>` (comma-separated in one header for cross-platform safety, especially Google-managed Vertex; SDKs expose `client.beta` with `betas=[...]`) (F38).
- **Payload limits (413 `request_too_large`):** First-party Messages / Token Counting `128 MB`, Message Batches `256 MB`, Files API `500 MB`; Anthropic-operated cloud platforms `32 MB`; Google-managed Vertex `30 MB`; Amazon Bedrock `20 MB` (F3).
- **SDK long-request rule:** Client-side validation rejects non-streaming `messages.create()` when `max_tokens > 21333`; use `client.messages.stream()` + `stream.get_final_message()` (Python) / `stream.finalMessage()` (TypeScript) (F6).
- **SDK retries:** `max_retries` (`maxRetries` in TS) defaults to `2`, honoring `retry-after` on `429` / `5xx` / connection errors (F35).

### 2. Request Body & Response `Message` Shape

**Request body (`POST /v1/messages`):**

| Field | Type & Constraints | Notes |
|---|---|---|
| `model` | `string` (required) | Pinned snapshot ID (e.g. `claude-opus-5-5`) or pre-4.6 alias (F36). |
| `max_tokens` | `integer >= 0` (required) | Hard cap on thinking + output tokens; `0` warms cache only (F5). |
| `messages` | `MessageParam[]` (required) | Alternating `user`/`assistant` turns; consecutive same-role turns merge; `content` is `string` or block array (F7). |
| `system` | `string \| TextBlockParam[]` | Top-level system prompt; blocks support `cache_control` (F39). |
| `tools` | `ToolUnion[]` | Client tools (`name`, `description`, `input_schema`, optional `strict`, `eager_input_streaming`, `input_examples`, `defer_loading`, `allowed_callers`, `cache_control`), client toolsets (`computer_toolset_20260801`, `browser_toolset_20260801`), or server tools (`web_search_20260318`, etc.) (F24, F39). |
| `tool_choice` | `object` | `{type: "auto" \| "any" \| "none"}` or `{type: "tool", name: "..."}` plus optional `disable_parallel_tool_use: bool` (valid on `auto`, `any`, `tool`) (F10, F11). |
| `thinking` | `object` | `{type: "adaptive", display?: "summarized" \| "omitted" \| "updates"}`, `{type: "enabled", budget_tokens >= 1024, display?}` (legacy, 400 on 4.7+), `{type: "between_tools"}` (Sonnet 5.5 only, effort <= `high`), or `{type: "disabled"}` (400 on Opus 5.5, Fable/Mythos 5.x, Sonnet 5.5) (F12). |
| `output_config` | `object` | `effort`: `"low" \| "medium" \| "high" \| "xhigh" \| "max"` (F13); `format`: `{type: "json_schema", schema: {...}}` (F25). |
| `metadata` | `object` | `{user_id?: string}` (max 512 chars, opaque ID, no PII) (F9). |
| `stop_sequences` | `string[]` | Custom strings halting generation with `stop_reason: "stop_sequence"`. |
| `stream` | `boolean` | Enables SSE event stream (`false` by default) (F29). |
| `cache_control` | `object` | Top-level automatic breakpoint: `{type: "ephemeral", ttl?: "5m" \| "1h"}` (F39). |
| `service_tier` | `"auto" \| "standard_only"` | Controls Priority Tier capacity usage. |
| `speed` | `"standard" \| "fast"` | Fast mode (up to 2.5× OTPS on supported models) (F40). |
| `container` | `string \| object` | `{id?, skills?: [...]}` for reusing code-execution/skills containers. |
| `diagnostics` | `object` | `{previous_message_id: string \| null}` to populate `diagnostics.cache_miss_reason`. |
| `inference_geo` | `string \| null` | Overrides workspace default inference region. |
| *(removed)* | `temperature`, `top_p`, `top_k` | Removed in `anthropic-version: 2026-10-21`; sending any value returns `400` (F4). |

**Response `Message` object:** `id` (`msg_...`), `type: "message"`, `role: "assistant"`, `model`, `content: ContentBlock[]`, `stop_reason`, `stop_sequence: string | null`, `stop_details: RefusalStopDetails | null`, `container: Container | null`, `diagnostics: Diagnostics | null`, `usage: Usage` (F33, F34).

### 3. Content Block Types

| `type` | Direction | Key Fields & Constraints |
|---|---|---|
| `text` | In / Out | `text` (`minLength: 1` on input), optional `cache_control` (in), `citations` (out; non-empty `citations` in `user` input returns `400` in `2026-10-21`) (F4). |
| `image` | In (`user`, `tool_result`) | `source`: `{type: "base64", media_type: "image/jpeg"\|"image/png"\|"image/gif"\|"image/webp", data}` \| `{type: "url", url}` \| `{type: "file", file_id}`; optional `transformations: {oversized_image: "downsize"\|"error"}`, `cache_control`. Max 8000×8000 px, 10 MB base64 (5 MB Bedrock), 600 images/req (100 on 200K models); >20 images enforces stricter pixel cap (<=3000 px safe cross-platform) (F14, F15). |
| `document` | In (`user`, `tool_result`) | `source`: `base64` (`application/pdf`), `url` (PDF), `file` (`file_id`), `text` (`text/plain`), or `content` (`string \| (text \| image)[]`); optional `title`, `context`, `citations: {enabled}`, `cache_control`. PDF max 600 pages (100 if <1M context). Rejects `document` directly in `assistant` (`400`) (F4, F16). |
| `search_result` | In (`user`, `tool_result`) | `source` (URL or ID), `title`, `content: TextBlockParam[]` (text only, no images), optional `citations: {enabled}` (default `false`; all blocks must match), `cache_control` (F17). |
| `thinking` | Out / In (`assistant` echo) | `thinking` (summary text, or `""` when `display: "omitted"`), `signature` (encrypted reasoning). Must be echoed unmodified in tool-use turns (F12, F18). |
| `redacted_thinking` | Out / In (`assistant` echo) | `data` (encrypted safety-redacted reasoning). No readable text; must be echoed unmodified when round-tripping tool-use turns (F18, F29). |
| `tool_use` | Out / In (`assistant` echo) | `id` (`toolu_...`), `name`, `input` (JSON object), `caller` (`direct` \| `code_execution_...`), optional `toolset_name` (for computer/browser toolsets) (F21, F30). |
| `tool_result` | In (`user` only) | `tool_use_id`, optional `content` (`string` or array of `text`, `image`, `document`, `search_result`, `tool_reference`, `browser_state`), optional `is_error: bool`, `cache_control` (F19, F20, F21). |
| `server_tool_use` | Out / In (`assistant` echo) | `id` (`srvtoolu_...`), `name` (`web_search`, `web_fetch`, `code_execution`, etc.), `input`, `caller` (F22). |
| `web_search_tool_result` | Out / In (`assistant` echo) | `tool_use_id` (`srvtoolu_...`), `content`: `WebSearchResultBlock[]` (`type: "web_search_result"`, `url`, `title`, `page_age`, `encrypted_content`) OR `{type: "web_search_tool_result_error", error_code}` (codes: `too_many_requests`, `invalid_tool_input`, `max_uses_exceeded`, `query_too_long`, `request_too_large`, `unavailable`). Echo `encrypted_content` unchanged in history (F23, F29). |

### 4. Tool-Use Message Ordering & `tool_choice` Restrictions

- **Adjacency & order:** After an assistant response with `stop_reason: "tool_use"`, the very next message must be `role: "user"` (no intervening messages) (F19), and all `tool_result` blocks must appear **before** any `text` block (`400` otherwise) (F20).
- **Parallel tool results:** Combine all `tool_result` blocks for every `tool_use.id` in that assistant turn into a single `user` message (F21). If you skip executing a call after an earlier failure, still emit a `tool_result` with `is_error: true` explaining why (F21).
- **Mixed client + waiting server tool:** If an assistant turn contains both client `tool_use` and a `server_tool_use` with no matching result block yet, the follow-up `user` message must contain **only** `tool_result` blocks (any trailing `text` ends the turn early and triggers `400` naming the unresolved server tool) (F22).
- **`tool_choice` options & restrictions:**
  - `{"type": "auto", "disable_parallel_tool_use"?: bool}` — default when `tools` is present; `disable_parallel_tool_use: true` caps calls at 0 or 1 (F10).
  - `{"type": "none"}` — disables tool calling.
  - `{"type": "any", "disable_parallel_tool_use"?: bool}` and `{"type": "tool", "name": "...", "disable_parallel_tool_use"?: bool}` — force 1+ (or exactly 1) tool calls, suppress pre-tool text and thinking blocks where accepted, and **return `400`** under manual extended thinking (`type: "enabled"`) and unconditionally on Opus 5.5, Sonnet 5.5, Fable 5.1/5.2, and Mythos 5.1/5.2 (F11).

### 5. `input_schema`, Strict Tool Use, and Structured Outputs

- **Non-strict `input_schema`:** Standard JSON Schema (`type: "object"`, `properties`, `required` array for mandatory fields; omitted keys are optional). Tool `name` must match `^[a-zA-Z0-9_-]{1,128}$` (F24). `input_examples` adds validated concrete usage examples (F24).
- **Strict mode & JSON outputs:**
  - Tool-level: set `"strict": true` on individual client tools (not supported on `mcp_toolset`, `computer_toolset_20260801`, `browser_toolset_20260801`, or combined with `code_execution` in `allowed_callers`).
  - Response-level: set `output_config: {"format": {"type": "json_schema", "schema": {...}}}` (GA, no beta header) (F25). Deprecated top-level `output_format` requires `anthropic-beta: structured-outputs-2025-11-13` (and raises `TypeError` for raw dicts in Python SDK v1.0+) (F25).
- **Schema subset & limits:** Supports basic types, `enum`, `const`, `anyOf`, `allOf`, `$ref`/`$defs`/`definitions`, `default`, `required`, `additionalProperties: false` (mandatory on every object), `minItems` (`0` or `1` only), and string formats (`date-time`, `time`, `date`, `duration`, `email`, `hostname`, `uri`, `ipv4`, `ipv6`, `uuid`). Rejects (`400`) recursive schemas, `oneOf`, `not`, numeric bounds (`minimum`/`maximum`/`multipleOf`), string length bounds (`minLength`/`maxLength`), and `additionalProperties != false` (F27).
- **Complexity limits (combined across all strict tools + output schema per request):** `<= 20` strict tools, `<= 24` optional (non-`required`) parameters, `<= 16` union-type (`anyOf` or type-array) parameters, plus an internal size cap and `180 s` compilation timeout (F27). Compiled grammars cache for 24 h (F27).
- **Output ordering & failure modes:** Required properties are always emitted before optional properties (F26). String `enum`/`const` casing is not strictly enforced (compare case-insensitively) (F28). Safety `refusal` and `max_tokens` truncation both return HTTP `200` and can produce schema-invalid output (F28). Incompatible with `citations` (`400`) and message prefill (F25, F28).

### 6. Streaming SSE Event Sequence

1. `message_start`: carries `Message` skeleton (`content: []`, `stop_reason: null`, initial `usage`) (F29, F34).
2. Per content block (`index: 0, 1, ...`):
   - `content_block_start`: initial block (`text`, `thinking`, `tool_use`, `server_tool_use`, or whole blocks `redacted_thinking` / `web_search_tool_result`).
   - `content_block_delta` (0 or more): `delta.type` is `text_delta` (`text`), `input_json_delta` (`partial_json` string fragments), `thinking_delta` (`thinking` text; `""` when `display: "omitted"`), `signature_delta` (`signature`, right before stop), or `citations_delta` (`citation`) (F29, F30).
   - `content_block_stop`: marks block completion (`index`).
3. `message_delta` (1+): carries `delta.stop_reason`, `delta.stop_sequence`, `delta.stop_details`, `delta.container`, and **cumulative** `usage` (F32, F34).
4. `message_stop`: terminal SSE event (no `data: [DONE]`) (F29).
5. Interleaved events: `ping` (keepalive anywhere) and `error` (mid-stream failure, e.g. `overloaded_error`, after HTTP 200 headers were already sent) (F29).
- **Fine-grained tool streaming:** Setting `eager_input_streaming: true` on a user tool (replaces `fine-grained-tool-streaming-2025-05-14`) skips server JSON buffering, so clients must guard `json.loads()` against partial/invalid JSON and `max_tokens` truncation (F31).

### 7. `usage` Fields

- `input_tokens`: non-cached input tokens after the final cache breakpoint (F33).
- `cache_creation_input_tokens` & `cache_read_input_tokens`: total input tokens equal `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` (F33).
- `cache_creation`: `{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}` breakdown by TTL.
- `output_tokens`: authoritative total billed output tokens (includes thinking tokens even when summarized/omitted) (F12).
- `output_tokens_details`: `{thinking_tokens}` (read-only observability count of raw reasoning tokens; `<= output_tokens`).
- `server_tool_use`: `{web_search_requests, web_fetch_requests}` (billed per search; failed searches not billed) (F23).
- `service_tier` (`"standard" | "priority" | "batch"`), `speed` (`"standard" | "fast"`), `inference_geo` (`string | null`).

### 8. `stop_reason` Values vs. HTTP Errors

**Successful HTTP 200 `stop_reason` values** (F34):
- `"end_turn"`: natural completion.
- `"max_tokens"`: hit `max_tokens` (may truncate JSON/tool arguments); continue or raise `max_tokens`.
- `"stop_sequence"`: matched an entry in `stop_sequences` (returned in `stop_sequence`).
- `"tool_use"`: model emitted client `tool_use` block(s) (possibly alongside an unresolved `server_tool_use`) (F22).
- `"pause_turn"`: server-tool loop hit its iteration cap (default 10); echo `assistant` `content` unchanged (and `container.id` if present) with no trailing `user` message to resume.
- `"refusal"`: classifier intervened (HTTP `200`, tokens billed); inspect `stop_details` (`{type: "refusal", category: "cyber" | "bio" | "frontier_llm" | "reasoning_extraction" | "general_harms" | null, explanation}`) and retry/fallback (F28).
- `"model_context_window_exceeded"`: generation hit context limit before `max_tokens` (GA on Sonnet 4.5+; older models require `model-context-window-exceeded-2025-08-26`).

**HTTP errors (`{"type": "error", "error": {"type", "message"}, "request_id"}`)** (F35):
- `400` `invalid_request_error` (bad schema, removed sampling params, unsupported `thinking`/`tool_choice`, workspace spend limit)
- `401` `authentication_error` (invalid/expired key or disallowed browser CORS)
- `402` `billing_error`
- `403` `permission_error`
- `404` `not_found_error`
- `409` `conflict_error`
- `413` `request_too_large` (exceeded payload MB cap) (F3)
- `429` `rate_limit_error` (RPM/TPM/ramp limit, or org tier spend cap without `retry-after`) (F35)
- `500` `api_error` (or `timeout_error` before response starts)
- `504` `timeout_error`
- `529` `overloaded_error` (also possible as mid-stream SSE `error` event) (F29, F35)

### 9. Current Model IDs, Aliases, Context Windows, and Max Output

| Model | Claude API ID / Alias | Context Window | Max Output (Sync / Batch Beta) | Default Effort & Thinking |
|---|---|---|---|---|
| Claude Fable 5.2 | `claude-fable-5-2` (pinned snapshot) | 1M | 128K / — | `high` · Adaptive (always on) |
| Claude Mythos 5.2 *(limited)* | `claude-mythos-5-2` (pinned snapshot) | 1M | 128K / — | `high` · Adaptive (always on) |
| Claude Opus 5.5 | `claude-opus-5-5` (pinned snapshot) | 1M | 128K / 300K | `medium` · Adaptive (always on) |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` (pinned snapshot) | 1M | 128K / 300K | `high` · Adaptive (`between_tools` allowed) |
| Claude Haiku 5.5 | `claude-haiku-5-5` (pinned snapshot) | 1M | 128K / 300K | `medium` · Adaptive (`disabled` at `<=high`) |
| Claude Opus 5 | `claude-opus-5` (pinned snapshot) | 1M | 128K / 300K | `high` · Adaptive (`disabled` at `<=high`) |
| Claude Sonnet 5 | `claude-sonnet-5` (pinned snapshot) | 1M | 128K / 300K | `high` · Adaptive (`disabled` allowed) |
| Claude Opus 4.8 / 4.7 / 4.6 | `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6` | 1M | 128K / 300K | `high` · Off by default (enable `adaptive`) |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` (pinned snapshot) | 1M | 128K / 300K | `high` · Off by default (enable `adaptive`) |
| Claude Opus 4.5 | `claude-opus-4-5-20251101` (alias `claude-opus-4-5`) | 200K | 64K / — | Extended thinking (`enabled`) |
| Claude Sonnet 4.5 *(retires 2026-11-30)* | `claude-sonnet-4-5-20250929` (alias `claude-sonnet-4-5`) | 200K | 64K / — | Extended thinking (`enabled`) |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5`) | 200K | 64K / — | Extended thinking (`enabled`, no interleaved) |

*(Plus prior 5.x models `claude-fable-5-1`, `claude-mythos-5-1`, `claude-fable-5`, `claude-mythos-5` at 1M / 128K; `output-300k-2026-03-24` raises Batch API output ceiling to 300K on listed models) (F36, F37).*

### 10. Beta Headers vs. GA Features

| Feature | `anthropic-beta` Header | Status / Scope Notes |
|---|---|---|
| Context editing (`clear_tool_uses_...`, `clear_thinking_20251015`) | `context-management-2025-06-27` | Required (beta) (F38). |
| Thinking progress updates (`display: "updates"`) | `thinking-display-updates-2026-08-18` | Required (beta); `400` without header (F12). |
| Preserved-thinking binding controls | `thinking-binding-controls-2026-08-01` | Required for `thinking.block_binding` (F38). |
| Fast mode (`speed: "fast"`) | `fast-mode-2026-02-01` | Required on Opus 5 and Opus 4.8 only; GA (no header) on Opus 5.5, Fable/Mythos 5.2 (F40). |
| Advisor tool (`advisor_20260301`) | `advisor-tool-2026-03-01` | Required (beta). |
| MCP connector (`mcp_toolset`) | `mcp-client-2025-11-20` | Required (beta). |
| 300K Batch output ceiling | `output-300k-2026-03-24` | Required on Message Batches API for 300K output (F37). |
| Deprecated `output_format` | `structured-outputs-2025-11-13` | Only needed for deprecated `output_format`; `output_config.format` and `strict: true` are GA (F25). |
| Legacy `computer_20251124` / `computer_20250124` | `computer-use-2025-11-24` / `computer-use-2025-01-24` | Only for legacy dated tools; `computer_toolset_20260801` and `browser_toolset_20260801` need none. |
| Fine-grained tool streaming | `fine-grained-tool-streaming-2025-05-14` | Legacy global opt-in (conflicts with toolsets); use per-tool `eager_input_streaming: true` (GA) (F31). |
| Interleaved thinking (manual `enabled` mode) | `interleaved-thinking-2025-05-14` | Only for manual `enabled` mode on Opus 4.5 / 4.6 / Sonnet 4.6; automatic with `adaptive` (no header). |
| Files API, `web_search`, `web_fetch`, `code_execution`, `tool_search`, `strict: true`, `output_config.format` | **None** | GA; `files-api-2025-04-14` is optional/legacy (F25). |

## Practitioner reasoning

- **[INFERENCE] Prefix-cache stability dictates request layout:** Because prompt caching hashes `tools` → `system` → `messages` in order (F39), put static tool definitions and system instructions first with explicit `cache_control` breakpoints, keep `thinking` mode and top-level `output_config.effort` constant across turns, and place volatile timestamps or user state at the tail of `messages`.
- **[INFERENCE] Prefer `auto` + `strict: true` over forced `tool_choice`:** Since Opus 5.5, Sonnet 5.5, and Fable/Mythos 5.1–5.2 reject `tool_choice: {"type": "any" | "tool"}` with `400` (F11) and forced choice suppresses thinking on older models, standardize agent loops on `tool_choice: {"type": "auto"}` paired with `strict: true` schemas and explicit prompting.
- **[INFERENCE] Separate transport retry from semantic `stop_reason` routing:** Retry HTTP `429`/`5xx` (or mid-stream `error` events) with jittered backoff honoring `retry-after` (F35), but route `200` responses strictly on `stop_reason` (`tool_use`, `pause_turn`, `max_tokens`, `refusal`, `end_turn`) (F34). Never blindly treat HTTP `200` + `output_config.format` as schema-valid without checking `stop_reason` and case-normalizing enum values (F28).
- **[INFERENCE] Guard streaming tool execution:** Accumulate `input_json_delta` chunks until `content_block_stop` and verify `message_delta.stop_reason == "tool_use"` before invoking side-effecting tools, especially when `eager_input_streaming: true` is active (F30, F31).

## Worked example(s)

Runnable Python (`anthropic>=1.0`, targeting `anthropic-version: 2026-10-21`) demonstrating streaming event accumulation, parallel client `tool_use` execution, `is_error` reporting, strict `tool_result`-first ordering, and `stop_reason` / cumulative `usage` inspection:

```python
import anthropic

client = anthropic.Anthropic()  # sends anthropic-version automatically

tools = [
    {
        "name": "get_stock",
        "description": "Fetch latest price for a ticker symbol.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
            "additionalProperties": False,
        },
    }
]

messages = [{"role": "user", "content": "Compare AAPL and MSFT prices."}]

while True:
    # SDK requires .stream() when max_tokens > 21333; also exposes incremental deltas.
    with client.messages.stream(
        model="claude-sonnet-5-5",
        max_tokens=32000,
        tools=tools,
        tool_choice={"type": "auto"},  # forced "any"/"tool" returns 400 on Sonnet 5.5
        output_config={"effort": "medium"},
        messages=messages,
    ) as stream:
        for event in stream:
            if event.type == "content_block_delta" and event.delta.type == "text_delta":
                print(event.delta.text, end="", flush=True)
        resp = stream.get_final_message()

    # Always echo full assistant content (including thinking / redacted_thinking blocks).
    messages.append({"role": "assistant", "content": resp.content})

    if resp.stop_reason == "tool_use":
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                try:
                    price = "228.50" if block.input["ticker"] == "AAPL" else "415.10"
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": price,
                    })
                except Exception as exc:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": f"Lookup failed: {exc}",
                        "is_error": True,
                    })
        # All parallel tool_results go in ONE user message, BEFORE any text (or alone if server tool pending).
        messages.append({"role": "user", "content": tool_results})
    elif resp.stop_reason == "pause_turn":
        # Server tool loop hit 10-iteration limit; re-send assistant turn with no user message.
        continue
    else:
        print(f"\n[stop={resp.stop_reason} in={resp.usage.input_tokens} out={resp.usage.output_tokens}]")
        break
```

## Diagram spec

- **Type:** Sequence diagram.
- **Actors:** `Client App`, `Messages API (POST /v1/messages)`, `Client Tools`.
- **Edges:**
  1. `Client App` → `Messages API`: `POST /v1/messages` (`stream: true`, `tools`, `messages: [user]`).
  2. `Messages API` → `Client App`: SSE `message_start` (`stop_reason: null`) → `content_block_start/delta/stop` (`thinking` + `signature_delta`, `tool_use` ×2 with `input_json_delta`) → `message_delta` (`stop_reason: "tool_use"`, cumulative `usage`) → `message_stop`.
  3. `Client App` → `Client Tools`: Concurrent dispatch of `tool_use[0]` and `tool_use[1]` (only after `content_block_stop` + `stop_reason == "tool_use"`).
  4. `Client Tools` → `Client App`: Results (one ok, one error → `is_error: true`).
  5. `Client App` → `Messages API`: `POST /v1/messages` (`messages: [user, assistant (raw content incl. thinking/redacted_thinking), user ([tool_result_0, tool_result_1])]`).
  6. `Messages API` → `Client App`: SSE `text_delta` stream → `message_delta` (`stop_reason: "end_turn"`) → `message_stop`.
- **Caption:** "Single-turn tool loop over SSE: echo all assistant blocks unmodified, group all matching `tool_result` blocks first in one `user` message, and branch control flow on `message_delta.stop_reason`."

## Exam lens

- **[Editorial inference] Stop-reason vs. HTTP-error branching:** Scenarios frequently pair a `200` `stop_reason: "refusal"` or `"max_tokens"` (under `output_config.format`) with a `429` or `529`; correct designs retry transient HTTP errors with backoff, raise `max_tokens` or continue on truncation, and inspect `stop_details` / switch models on `refusal` rather than treating `refusal` as a rate limit or schema bug.
- **[Editorial inference] Model migration traps:** Moving from 4.5/4.6 to 5.5 models breaks requests that send `temperature` (`2026-10-21`), `thinking: {type: "enabled", budget_tokens: ...}`, `thinking: {type: "disabled"}` (on Opus/Sonnet 5.5), assistant prefill, or `tool_choice: {type: "any" | "tool"}`.
- **[Editorial inference] Multi-turn history invariants:** Filtering `response.content` to drop `redacted_thinking`, stripping `encrypted_content` from `web_search_tool_result`, inserting a `text` block before `tool_result`, or adding trailing `text` alongside a waiting `server_tool_use` all trigger `400` errors or silent reasoning loss.

## Common mistakes

1. **Sending `temperature`, `top_p`, or `top_k` with `anthropic-version: 2026-10-21`:** Returns HTTP `400` on every model (F4).
2. **Putting `text` before `tool_result`, splitting parallel `tool_result`s across multiple `user` messages, or adding `text` when a `server_tool_use` is pending:** Violates adjacency/ordering rules and returns `400` or ends the turn prematurely (F19, F20, F21, F22).
3. **Using `tool_choice: {"type": "any" | "tool"}` on Opus 5.5 or Sonnet 5.5 (or with manual extended thinking):** Rejected with `400` (F11).
4. **Filtering `block.type == "thinking"` when round-tripping assistant content:** Silently drops `redacted_thinking` blocks and breaks tool-use continuity (F18).
5. **Passing `output_format` without `structured-outputs-2025-11-13` (or passing a dict to `output_format` in Python SDK v1.0+):** Use `output_config.format` (GA) instead (F25).
6. **Adding `message_delta.usage.output_tokens` across SSE events or trusting strict JSON on `refusal`/`max_tokens`:** `message_delta.usage` is already cumulative (F32), and `refusal`/`max_tokens` return HTTP `200` with potentially invalid JSON (F28).

## Self-check

1. **Q:** In an assistant response containing `[thinking, redacted_thinking, server_tool_use (no result yet), tool_use]`, how must the next `messages` entry be constructed?
   **A:** Append the assistant `content` array unchanged (keeping `thinking`, `redacted_thinking`, `server_tool_use`, and `tool_use`), then append one `role: "user"` message containing **only** the `tool_result` block for the client `tool_use` (no `tool_result` for `server_tool_use`, and no `text` block) (F18, F22).
2. **Q:** Why can a request with `output_config.format` and 3 `strict: true` tools fail compilation with `400` even when each tool looks simple?
   **A:** Complexity limits apply across the **sum** of all strict tools and the output schema in the request (max 20 strict tools, 24 optional parameters, 16 union-type parameters, plus internal grammar size / 180 s timeout) (F27).
3. **Q:** Which `anthropic-beta` header is required to use `output_config.format` and `strict: true` today?
   **A:** None—both are GA; `structured-outputs-2025-11-13` is only needed if you still use the deprecated `output_format` parameter (F25).

## Unresolved

- Exact internal compiled-grammar byte/state threshold for `"Schema is too complex for compilation"` beyond the documented explicit limits (20 strict tools, 24 optional parameters, 16 union-type parameters, 180 s compilation timeout) is not publicly quantified in Anthropic's docs.
- Exact per-image pixel threshold enforced when a request exceeds 20 images varies by platform/error message; Anthropic documents resizing to `<= 3000 px` per dimension as safe across all platforms.
