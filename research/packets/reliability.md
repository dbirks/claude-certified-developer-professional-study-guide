# 2.1 Reliability Engineering for Claude Services

Official objective:
> Evaluating and applying resilience patterns for production Claude integrations, including retry and backoff design, circuit breakers, graceful degradation, and cross-model, cross-region, and cross-platform fallbacks that distinguish rate limits from safety refusals from context-window stops while respecting per-platform feature parity.

## Scope map

| Official sub-objective | Packet section(s) |
|---|---|
| Evaluating and applying resilience patterns for production Claude integrations | Core facts; Practitioner reasoning; Worked example(s) |
| Retry and backoff design | Core facts; Exact API / config details; Practitioner reasoning |
| Circuit breakers | Practitioner reasoning; Worked example(s); Diagram spec |
| Graceful degradation | Practitioner reasoning; Worked example(s) |
| Cross-model, cross-region, and cross-platform fallbacks | Core facts; Exact API / config details; Worked example(s) |
| Distinguish rate limits from safety refusals from context-window stops | Core facts; Exact API / config details; Exam lens |
| Respecting per-platform feature parity | Core facts; Exact API / config details; Common mistakes |

## Core facts

* **Client errors (`400`, `401`, `402`, `403`, `404`, `413`) are non-retryable:** `400 invalid_request_error` covers malformed requests, unsupported model parameters (such as assistant prefill on Claude 4.6+, `thinking.type.disabled` on always-thinking models, or forced `tool_choice` on Claude 5.x), and user-set org/workspace spend limits (Claude Code workspaces may return `429` instead) (F1). `401 authentication_error` covers bad/expired keys, AWS SigV4 mismatches, and browser CORS rejections under ZDR/Compliance settings (F2). `402 billing_error`, `403 permission_error`, `404 not_found_error`, and `413 request_too_large` (enforced by Cloudflare on first-party API; tighter caps on Bedrock and Vertex AI) never succeed on blind retry (F4, F5).
* **Conflict and transient errors (`409`, `429`, `500`, `504`, `529`):** `409 conflict_error` requires resolving concurrent resource conflicts before retrying (F3). `429 rate_limit_error` spans RPM/ITPM/OTPM limits, ramp limits, and monthly tier spend caps—the latter omits `retry-after` and keeps failing until access resumes (F6). `500 api_error`, `504 timeout_error` (also possible with HTTP `500` if a server timeout occurs before response start), and `529 overloaded_error` (API-wide traffic spikes) are transient (F7, F8).
* **Request IDs and rate-limit accounting:** Every response includes `request-id` (and `request_id` in JSON errors), exposed as `_request_id` in Python/TypeScript SDKs (F9); Claude Platform on AWS adds `x-amzn-requestid` for CloudTrail alongside `request-id` (F10). Rate limits use a continuously replenished token bucket (F11), count only uncached `input_tokens + cache_creation_input_tokens` toward ITPM (excluding `cache_read_input_tokens`) (F12), meter OTPM on actual generated tokens rather than `max_tokens` (F13), share pools across `inference_geo` values (F15), and return `retry-after` plus `anthropic-ratelimit-*` headers (`tokens-*` shows the tightest active limit) (F14).
* **SDK retry and timeout defaults:** Official Python (`anthropic`) and TypeScript (`@anthropic-ai/sdk`) SDKs default to `max_retries=2` / `maxRetries: 2`, retrying connection errors, `408`, `409`, `429`, and `>=500` with exponential backoff while honoring `retry-after` (F16, F17). Default timeout is 10 minutes; Python raises `ValueError` if a non-streaming request is projected > ~10 minutes unless `stream=True` or `timeout` is overridden (F18), whereas TypeScript scales non-streaming timeout dynamically up to 60 minutes by `max_tokens` and throws `APIConnectionTimeoutError` (F19). Timeouts are retried twice by default (F18, F19).
* **HTTP 200 incomplete states and mid-stream SSE errors:** Every `200 OK` response carries `stop_reason`, which can indicate truncation (`max_tokens`, `model_context_window_exceeded`—automatic on Sonnet 4.5+, beta header on earlier models), pending loops (`tool_use`, `pause_turn` at default 10 server-tool iterations), or a safety `refusal` (F20, F21, F22, F23). Mid-stream `event: error` (e.g., `overloaded_error`) arrives after HTTP `200`; on Claude 4.6+, recovery must use a `user` continuation message (prefill returns `400`), and partial `tool_use`/`thinking` blocks cannot be recovered (F24, F25).
* **Refusal handling and fallback boundaries:** Classifier refusals return HTTP `200` with `stop_reason: "refusal"` and `stop_details`; discard any partial streamed output (F26). Retrying the same model usually fails again (F27), and `reasoning_extraction` has no fallback model (revise the prompt instead) (F28). Server-side fallback (`fallbacks="default"`, beta `server-side-fallback-2026-07-01`) works only on first-party Claude API and Google Cloud (Anthropic managed), not on Haiku 5.5, Bedrock, Google-managed Vertex AI, or Microsoft Foundry (F29).
* **Cross-platform pools and parity:** Claude Platform on AWS uses a separate capacity pool from the first-party Claude API and Amazon Bedrock for cross-platform failover (F30). Bedrock and Google-managed Vertex AI provide global endpoints (no premium) and regional/multi-region endpoints (+10% premium) (F31, F32); Azure-hosted Microsoft Foundry rejects unsupported tools/APIs with `400 Bad Request` and omits `anthropic-ratelimit-*` headers (F33).
* **Tool retry bounds, jitter, retry budgets, and idempotency:** Returning `is_error: true` in `tool_result` can trigger another `tool_use` attempt, so loops must bound tool retries (F34). Combining per-request retry limits with a per-client retry ratio budget (e.g., 10%, capping overload growth at ~1.1x instead of 3x), jitter, and idempotency keys prevents cascading failures and duplicate side effects (F35).

## Exact API / config details

### Error JSON shape & classification decision table

Error bodies return `{"type": "error", "error": {"type": "...", "message": "...", "details": {...}}, "request_id": "req_..."}` (F9).

| HTTP Status | `error.type` / Condition | Python / TS Exception | Retry? | SDK Auto-Retry (`max_retries=2`) | Signal & Action |
|---|---|---|---|---|---|
| `400` | `invalid_request_error` | `BadRequestError` | No | No | Bad schema, unsupported model feature (prefill on 4.6+, `thinking.type.disabled` on Opus 5.5), or user-set spend limit reached (F1). Fix request or raise user limit. |
| `401` | `authentication_error` | `AuthenticationError` | No | No | Invalid/expired key, SigV4 error, or browser `Origin` blocked by ZDR/Compliance CORS (`CORS requests are not allowed...`) (F2). Call from backend or refresh credentials. |
| `402` | `billing_error` | `APIStatusError` | No | No | Payment/billing failure in Console or AWS Marketplace. Fail fast; alert billing. |
| `403` | `permission_error` | `PermissionDeniedError` | No | No | Insufficient key/workspace/IAM permissions. Fix RBAC/IAM. |
| `404` | `not_found_error` | `NotFoundError` | No | No | Unknown path, resource ID, or deployment name. Fix config. |
| `408` | Request timeout | `APIStatusError` | Yes | Yes | Upstream/proxy timeout; safe to retry idempotent calls (F17). |
| `409` | `conflict_error` | `ConflictError` | Conditional | Yes | Concurrent modification or non-unique value (F3). Resolve state conflict before re-submitting. |
| `413` | `request_too_large` | `APIStatusError` | No | No | Exceeded payload cap: 128 MB Messages/Count, 256 MB Batch, 500 MB Files (1P); 20 MB Bedrock; 30 MB Vertex; 32 MB managed cloud (F4, F5). Shrink payload. |
| `429` | `rate_limit_error` (`enforced_spend_limit_reached`) | `RateLimitError` | **No** | Yes (wasteful) | Monthly tier spend cap hit ($500 Start / $1k Build / $200k Scale). **No `retry-after` header**; `error.details.error_code == "enforced_spend_limit_reached"` (F6). Fail fast; alert ops. |
| `429` | `rate_limit_error` (`ramp_limit_exceeded` or RPM/ITPM/OTPM) | `RateLimitError` | Yes | Yes | Token-bucket or ramp limit hit (F11). Honor `retry-after` + jitter; pace traffic and cache prefixes (F12, F14). |
| `500` | `api_error` or `timeout_error` | `InternalServerError` | Yes | Yes | Internal error or pre-response server timeout (`timeout_error`) (F7). Exponential backoff + jitter; log `request_id` (F9). |
| `504` | `timeout_error` | `InternalServerError` | Yes | Yes | Processing timeout (F7). Use streaming or Message Batches API for >10-min jobs; retry with backoff. |
| `529` | `overloaded_error` | `InternalServerError` | Yes | Yes | API-wide overload (F8). Backoff + jitter, shed load, or fail over cross-platform/region (F30). |
| `200` + SSE `error` | `overloaded_error` mid-stream | Stream event | Conditional | **No** | SDK HTTP retry cannot fire post-200. Capture completed text and resume via `user` message on 4.6+ (F24, F25). |
| Connection / Timeout | Network drop / client timeout | `APIConnectionError` / `APITimeoutError` (`APIConnectionTimeoutError`) | Yes (if safe) | Yes | Default 10-min timeout (up to 60 min in TS) (F18, F19). Enable streaming/keep-alive; guard side effects (F35). |

### Headers & SDK options

* **Rate-limit headers:** `retry-after` (seconds; omitted on tier spend-cap `429`) (F6); `anthropic-ratelimit-{requests,tokens,input-tokens,output-tokens}-{limit,remaining,reset}` (RFC 3339 resets; `tokens-*` reports the tightest active limit) and legacy `anthropic-priority-{input,output}-tokens-*` (F14). Microsoft Foundry omits `anthropic-ratelimit-*` headers (F33).
* **Correlation headers:** `request-id` (`message._request_id` in Python/TS, or via `with_raw_response` / `.withResponse()`), `anthropic-organization-id`, `anthropic-workspace-id` (F9); `x-amzn-requestid` (primary on Claude Platform on AWS alongside `request-id`) (F10); `apim-request-id` (on Microsoft Foundry alongside `request-id`).
* **SDK options:** Python `Anthropic(max_retries=2, timeout=600.0)` and `client.with_options(...)` (F17, F18); TypeScript `new Anthropic({ maxRetries: 2, timeout: 600_000 })` with non-streaming dynamic timeout `max(600s, 3600s * max_tokens / 128_000)` up to 60 min (F19). Both set TCP socket keep-alive.

### Every `stop_reason` value (HTTP 200)

| `stop_reason` | Meaning & Handling |
|---|---|
| `end_turn` | Natural completion (F20). Guard against 2–3 token empty `end_turn` caused by placing a user `text` block immediately after `tool_result`. |
| `max_tokens` | Output hit `max_tokens` (F20). Truncated: raise `max_tokens` (OTPM ignores `max_tokens` (F13)), continue, or flag partial output. |
| `stop_sequence` | Matched caller's `stop_sequences`; read `response.stop_sequence`. |
| `tool_use` | Execute client tools, append assistant `content` unchanged, and send `user` message with `tool_result` blocks **first**. If a waiting `server_tool_use` or `mcp_tool_use` block lacks a result, send **only** `tool_result` blocks (no text) and keep `tools`/`container`/`mcp_servers` (F22). Report tool failures with `is_error: true` and bound retries (F34). |
| `pause_turn` | Server-tool loop hit its default 10-iteration cap (F21). Append paused assistant `content` unchanged with **no** trailing user message, keep `tools`, and echo `response.container.id` if present within a bounded `max_requests` loop (F21). |
| `refusal` | Safety classifier intervened (F26). Discard partial output; inspect `stop_details` (`type`, `category` in `{"cyber","bio","frontier_llm","reasoning_extraction","general_harms",null}`, `explanation`, optional `recommended_model`). Never retry the same model (F27). For `reasoning_extraction`, revise prompt or use adaptive thinking (F28). Otherwise use server-side `fallbacks="default"` (`server-side-fallback-2026-07-01`), SDK `BetaRefusalFallbackMiddleware` + `BetaFallbackState`, or manual retry with `fallback_credit_token` (`fallback-credit-2026-07-01`) (F29). |
| `model_context_window_exceeded` | Output filled the context window before `max_tokens` (F23). Automatic on Sonnet 4.5+; requires `model-context-window-exceeded-2025-08-26` beta header on earlier models; typed in SDK `beta` namespace (F23). Compact/prune context or split work. |

### Cross-platform feature parity & routing matrix

| Platform | Operator & SDK Client | Max Payload | Global / Regional Routing | Server-Side Fallback | Parity Differences vs. First-Party Claude API |
|---|---|---|---|---|---|
| **Claude API (1P)** | Anthropic (`Anthropic`) | 128 MB Messages; 256 MB Batch; 500 MB Files (F4) | `inference_geo`: `"global"` or `"us"` (+10% price on 4.6+; shared rate limits) (F15) | Yes (beta, except Haiku 5.5) (F29) | Baseline: full features, Managed Agents, Batches, Files, Admin, Compliance. |
| **Claude Platform on AWS** | Anthropic (`AnthropicAWS`, `anthropic[aws]`) | 32 MB Messages/Count (F5) | `aws-external-anthropic.{region}.api.aws` + `inference_geo`; separate capacity pool (F30) | Yes (except Haiku 5.5) | Same-day parity; excludes HIPAA, Fast mode, OAuth, MCP tunnels, OpenAI-compat; 6h Managed Agents autonomous reauth; requires `aws iam enable-outbound-web-identity-federation` once/account; dual IDs (F10). |
| **Amazon Bedrock (`bedrock-mantle` / `bedrock-runtime`)** | AWS (`AnthropicBedrockMantle` SSE; `AnthropicBedrock` EventStream) | 20 MB (F5) | Global (no premium) vs Regional CRIS (`us.`/`eu.`/`jp.`/`au.`, +10%) (F31) | **No** (use SDK middleware) (F29, F31) | No Files API, server tools, Agent Skills, MCP connector, PTC, Batches, Models/Admin/Compliance, or Managed Agents. `bedrock-runtime` lacks automatic caching and puts betas in `anthropic_beta` body field; Fable/Mythos 5.2 are `bedrock-runtime`-only. |
| **GCP — Anthropic managed** | Anthropic (`AnthropicGoogleCloud`) | 32 MB Messages/Count (F5) | `claude.googleapis.com` (`global`) | Yes (except Haiku 5.5) (F29) | GCP IAM/ADC auth (no API keys); no MCP tunnels, pre-built sandbox workers, or linked billing. |
| **GCP — Google managed (Vertex AI)** | Google (`AnthropicVertex`) | 30 MB (F5) | `"global"`, multi-region (`"us"`/`"eu"`), or regional (+10%; regional only for Sonnet 4.6 & earlier) (F32) | **No** (use SDK middleware) (F29, F32) | Supports web search & fast mode; no Files API, code execution, web fetch, advisor, Agent Skills, MCP connector, PTC, Batches, Admin, or Managed Agents. |
| **Microsoft Foundry (Azure)** | Anthropic (`AnthropicFoundry`) | 32 MB Messages/Count (F5) | Azure deployments (Global Standard, US Data Zone Standard) | **No** (use SDK middleware) (F29) | Omits `anthropic-ratelimit-*` headers; adds `apim-request-id`; no Batches, Admin, Models, Compliance, Managed Agents, Advisor. **Hosted on Azure** returns **`400 Bad Request`** on code execution, Agent Skills, PTC, Files API, and web search/fetch newer than `20250305`/`20250910` (F33). |

## Practitioner reasoning

* **Never stack outer retries onto SDK retries:** Because SDKs already make up to 3 attempts (`max_retries=2`) (F16), adding an outer 3-attempt loop creates $3 \times 3 = 9\times$ load amplification during `529` incidents `[INFERENCE]`. Set `max_retries=0` on clients when an orchestrator manages retries, or reserve the outer loop strictly for cross-platform/cross-model hops. Enforce a process-wide retry ratio budget (e.g., 10% of requests) with full jitter to cap overload amplification near $1.1\times$ rather than $3\times$ (F35).
* **Circuit breakers and failure isolation:** `[INFERENCE]` Maintain per-endpoint 3-state circuit breakers (closed → open on sustained `5xx`/`529`/timeouts → half-open probe) paired with token-bucket retry throttling so an unhealthy region fails fast to an alternate pool (e.g., Claude API → Claude Platform on AWS) (F30). Never trip an availability circuit breaker on `400`, `401`, `403`, `413`, or `stop_reason: "refusal"`—those reflect client payload, auth, or safety policy, not infrastructure unavailability.
* **Graceful degradation ladder:** `[INFERENCE]` Under sustained `529` or `429` pressure: (1) defer batchable work to Message Batches API; (2) reduce `output_config.effort` or compact context; (3) fail over to an independent capacity pool **only after verifying feature parity** (e.g., disabling server tools or switching from `fallbacks="default"` to `BetaRefusalFallbackMiddleware` before routing to Bedrock/Vertex/Foundry) (F29, F31, F32, F33); (4) degrade to a higher-headroom model (`claude-sonnet-5-5` / `claude-haiku-5-5`).
* **Distinguishing rate limits, refusals, and context-window stops:** A `429` with `enforced_spend_limit_reached` and no `retry-after` is a hard monthly billing stop (do not retry) (F6), whereas RPM/ITPM/OTPM or `ramp_limit_exceeded` `429`s include `retry-after` and recover via caching and paced backoff (F12, F14). A `refusal` is an HTTP `200` policy stop requiring model fallback or prompt revision (not same-model retry) (F26, F27, F28). `model_context_window_exceeded` and `max_tokens` are HTTP `200` capacity stops requiring compaction or continuation (F20, F23).
* **Idempotency of tool side effects on retry:** Model inference is stateless on retry, **unless** client tools executed side effects in an earlier turn or Claude re-calls a tool after `is_error: true` (F34, F35). Persist tool results keyed by `(session_id, tool_use_id)` and pass deterministic idempotency keys to external mutation APIs so replaying a turn never double-charges or double-writes `[INFERENCE]`.

## Worked example(s)

### Worked scenario 1: Retry-budget sizing and cache-aware ITPM headroom

An agent service sends 1,000 requests/min to `claude-opus-5-5` (Start tier: 4,000 RPM, 2,000,000 ITPM, 400,000 OTPM), with a 15,000-token system+tool prefix and 1,000 new input tokens per request.
* **Uncached:** $1,000 \times 16,000 = 16,000,000\text{ ITPM}$ → exceeds the 2M limit by 8x (`429`).
* **Cached prefix (15,000 tokens):** `cache_read_input_tokens` do not count toward ITPM (F12), so only $1,000 \times 1,000 = 1,000,000\text{ ITPM}$ counts (50% headroom).
* **Under a 50% `529` brownout:** Unbudgeted retries (`max_retries=2`) amplify traffic toward $3\times$ worst case; adding a **10% per-client retry budget** caps retries at $100\text{ RPM}$ ($1,100\text{ RPM}$ total, $1.1\times$) (F35).

### Worked example 2: Python resilience wrapper with parity-safe failover

*Status: Illustrative runnable pattern using the current `anthropic` Python SDK (`max_retries=0` so the wrapper owns retry budgets and failover; verified with `ast.parse`, not run against live endpoints).*

```python
import random
import time
from dataclasses import dataclass
import anthropic
from anthropic import Anthropic, AnthropicBedrockMantle

@dataclass
class RetryBudget:
    window_requests: int = 0
    window_retries: int = 0
    max_retry_ratio: float = 0.10  # 10% retry budget

    def allow_retry(self) -> bool:
        if self.window_requests < 20:
            return True
        return (self.window_retries / self.window_requests) < self.max_retry_ratio

def backoff_with_jitter(attempt: int, retry_after: float | None = None, base: float = 0.5, cap: float = 8.0) -> float:
    if retry_after is not None and retry_after > 0:
        return retry_after + random.uniform(0.0, 0.5)
    return random.uniform(0.0, min(cap, base * (2 ** attempt)))  # full jitter

def call_with_resilience(
    primary: Anthropic,
    bedrock_fallback: AnthropicBedrockMantle | None,
    *,
    messages: list[dict],
    tools: list[dict],
    uses_server_tools: bool,
    budget: RetryBudget,
) -> anthropic.types.Message:
    budget.window_requests += 1
    model = "claude-opus-5-5"
    fallback_models = ["claude-sonnet-5-5", "claude-opus-4-8"]

    for attempt in range(3):
        try:
            resp = primary.messages.create(
                model=model,
                max_tokens=4096,
                messages=messages,
                tools=tools,
            )
        except anthropic.RateLimitError as exc:
            body = exc.body if isinstance(exc.body, dict) else {}
            code = body.get("error", {}).get("details", {}).get("error_code")
            if code == "enforced_spend_limit_reached":
                raise RuntimeError("Monthly tier spend cap reached; do not retry") from exc
            ra = exc.response.headers.get("retry-after")
            delay = backoff_with_jitter(attempt, float(ra) if ra else None)
            if not budget.allow_retry():
                raise
            budget.window_retries += 1
            time.sleep(delay)
            continue
        except anthropic.InternalServerError as exc:
            if exc.status_code == 529 and bedrock_fallback is not None and not uses_server_tools:
                # Parity guard: Bedrock lacks server tools & Files API
                return bedrock_fallback.messages.create(
                    model="anthropic.claude-opus-5-5",
                    max_tokens=4096,
                    messages=messages,
                    tools=tools,
                )
            if not budget.allow_retry():
                raise
            budget.window_retries += 1
            time.sleep(backoff_with_jitter(attempt))
            continue
        except (anthropic.BadRequestError, anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.NotFoundError):
            raise

        if resp.stop_reason == "end_turn":
            return resp
        if resp.stop_reason == "refusal":
            category = getattr(resp.stop_details, "category", None)
            if category == "reasoning_extraction" or not fallback_models:
                raise RuntimeError(f"Refusal ({category}); revise prompt or surface safe fallback")
            model = fallback_models.pop(0)
            continue
        if resp.stop_reason in ("max_tokens", "model_context_window_exceeded", "tool_use", "pause_turn"):
            return resp

    raise RuntimeError("Exhausted resilience attempts")
```

## Diagram spec

* **Type:** flow
* **Nodes and edges:**
  * `[Send Messages API request]` → `[HTTP status?]`
  * `[HTTP status?]` -- `400 / 401 / 402 / 403 / 404 / 413` --> `[Fail fast: fix request, auth, payload size, or user spend limit]`
  * `[HTTP status?]` -- `429 (enforced_spend_limit_reached)` --> `[Fail fast & alert billing (no retry-after)]`
  * `[HTTP status?]` -- `429 (rate/ramp limit) or 500 / 504 / 529 / timeout` --> `[Retry budget allows & circuit closed?]`
  * `[Retry budget allows & circuit closed?]` -- `Yes` --> `[Sleep retry-after or exp backoff + full jitter]` --> `[Send Messages API request]`
  * `[Retry budget allows & circuit closed?]` -- `No` --> `[Feature parity check]` --> `[Fail over to compatible pool (Claude Platform on AWS / Bedrock / Vertex) or degrade]`
  * `[HTTP status?]` -- `200 OK` --> `[SSE error event mid-stream?]`
  * `[SSE error event mid-stream?]` -- `Yes` --> `[Discard partial tool/thinking blocks; resume text via user message on 4.6+]`
  * `[SSE error event mid-stream?]` -- `No` --> `[Branch on stop_reason]`
  * `[Branch on stop_reason]` -- `end_turn / stop_sequence` --> `[Return complete response]`
  * `[Branch on stop_reason]` -- `tool_use` --> `[Run idempotent tools (bounded); return tool_result]`
  * `[Branch on stop_reason]` -- `pause_turn` --> `[Resend assistant content + container ID (bounded)]`
  * `[Branch on stop_reason]` -- `max_tokens / model_context_window_exceeded` --> `[Compact history or continue]`
  * `[Branch on stop_reason]` -- `refusal` --> `[Discard partial output; switch model (unless reasoning_extraction) or reset context]`
* **Caption:** Decision flow separating non-retryable HTTP errors, budgeted transient retries, parity-checked cross-platform failover, mid-stream SSE errors, and HTTP 200 `stop_reason` branches.

## Exam lens

*(Editorial inference based on the official November 2026 exam guide; Official Sample Item 1 in guide §7 tests branching retry logic on stop condition.)*

1. **Branching on `stop_reason` rather than HTTP status (Official Sample Item 1):** HTTP `200` responses can still be truncated (`max_tokens`, `model_context_window_exceeded`), paused (`pause_turn`), or refused (`refusal`). Items test choosing stop-reason-specific recovery (switching models on `refusal`, revising prompts on `reasoning_extraction`, passing `container` back on `pause_turn`) over generic error retries.
2. **Separating spend-cap `429` from rate-limit `429`:** Recognizing `enforced_spend_limit_reached` (no `retry-after`, fails until billing/tier change) vs `ramp_limit_exceeded` / token-bucket `429` (has `retry-after`, mitigated by prompt caching and jittered backoff).
3. **Cross-platform failover under feature-parity constraints:** Failing over from first-party Claude API to Bedrock, Google-managed Vertex AI, or Azure-hosted Foundry breaks server-side `fallbacks="default"`, Files API, Agent Skills, programmatic tool calling, and code execution (causing `400 Bad Request` on Azure-hosted Foundry), whereas Claude Platform on AWS provides a separate capacity pool with near-full parity.
4. **Mid-stream SSE recovery & retry stacking:** Resuming interrupted streams on Claude 4.6+ via `user` continuation messages (not assistant prefill), discarding partial `tool_use`/`thinking` blocks, and avoiding stacked SDK + outer retry loops without idempotency keys.

## Common mistakes

* **Retrying `refusal` on the same model:** Re-sending usually refuses again (F27); `reasoning_extraction` has no fallback model (F28).
* **Retrying tier spend-cap `429`s:** `enforced_spend_limit_reached` has no `retry-after` and fails until the next month or tier upgrade (F6).
* **Using assistant prefill to resume interrupted streams on Claude 4.6+:** Claude 4.6+ rejects assistant prefill with `400` and requires a `user` continuation message (F24).
* **Treating cross-platform failover as a drop-in URL swap:** Bedrock, Vertex AI (Google managed), and Azure-hosted Foundry lack server-side `fallbacks` and several tool/file APIs (F29, F31, F32, F33).
* **Omitting `container` ID or adding user text on `pause_turn`:** Dropping `container` loses sandbox files, and adding user text breaks continuation (F21).
* **Retrying timeouts without retry budgets or tool idempotency:** SDK defaults (`max_retries=2`) retry timeouts (F18, F19); unguarded outer loops amplify load and duplicate tool side effects (F34, F35).

## Self-check

1. **An API call returns HTTP `429` with no `retry-after` header and `error.details.error_code: "enforced_spend_limit_reached"`. What does the Python SDK do by default, and what should your service do?**
   *Answer:* The SDK retries twice and fails all attempts; your application should inspect `error.details.error_code`, abort retries immediately, alert billing/ops, and only fail over to an independent funded platform/account if parity permits.
2. **A streaming Claude Opus 5.5 response fails mid-stream with `event: error` (`overloaded_error`) halfway through a `tool_use` block. Can you recover it with assistant prefill?**
   *Answer:* No. Partial `tool_use` and `thinking` blocks cannot be partially recovered, and Claude 4.6+ models return `400` on assistant prefill. Discard the incomplete turn (or resume completed `text` blocks via a `user` message).
3. **Why does failing over an agent with `code_execution` and `fallbacks="default"` from the first-party Claude API to Azure-hosted Microsoft Foundry fail with `400 Bad Request`, and which AWS option avoids those parity gaps?**
   *Answer:* Azure-hosted Microsoft Foundry rejects `code_execution` with `400 Bad Request` and Foundry does not support server-side `fallbacks`. **Claude Platform on AWS** runs on an independent capacity pool from both the first-party Claude API and Amazon Bedrock while maintaining same-day parity for both features.

## Unresolved

* **SDK internal backoff constants and `x-should-retry`:** Verified in official SDK source (`_base_client.py`, `_constants.py`, `src/client.ts`) that Python/TS SDKs use `INITIAL_RETRY_DELAY = 0.5`, `MAX_RETRY_DELAY = 8.0`, up to 25% jitter, and honor `x-should-retry`, but these internals are omitted from `reliability.yaml` because `platform.claude.com/docs/en/api/errors` does not document them explicitly.
* **TypeScript SDK async-iterable body `maxRetries = 0` override:** Mentioned in search summaries for GitHub issues, not directly verified in `src/client.ts` during this session.
