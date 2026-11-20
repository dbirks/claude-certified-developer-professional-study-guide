# 6.2 Latency Engineering

> Analyzing the latency profile of a Claude application against a latency target, distinguishing time-to-first-token from total latency, and applying streaming, parallel tool execution, cache checkpointing, and effort-level tuning.

## Scope map

- Analyze latency against a target → Core facts; Practitioner reasoning; Worked example.
- Distinguish TTFT from total latency → Core facts; Exact API / config details; Worked example.
- Apply streaming → Core facts; Exact API / config details; Practitioner reasoning.
- Apply parallel tool execution → Core facts; Exact API / config details; Diagram spec.
- Apply cache checkpointing → Core facts; Exact API / config details; Practitioner reasoning.
- Apply effort-level tuning → Core facts; Exact API / config details; Practitioner reasoning.

## Core facts

- Measure at least TTFT, time to last token (TTLT, the whole response), and output tokens per second (OTPS). TTFT is the wait from sending the prompt to the first response token; TTLT adds the remaining generation and non-model work. Anthropic’s cookbook models task latency as approximately `calls × TTFT + output tokens ÷ OTPS + additional client- or server-side latency`. (F1, F2)
- A streamed response can improve perceived responsiveness by exposing output as it arrives; it does not make the model finish sooner by itself. A user-facing first-byte/first-token metric and a completion SLO answer different questions. (F3)
- Model-side response time varies with model size, prompt complexity, and infrastructure. Anthropic’s current latency guide recommends Haiku 5.5 for speed-critical tasks and describes it as the fastest response-time option in the lineup; model choice still needs a quality check on representative workload. (F4)
- Prompt length affects latency: fewer input tokens reduce processing, and cache hits avoid reprocessing a repeated prefix. Caching does not accelerate output-token generation, so it principally targets prefill/TTFT rather than OTPS or the generated tail. (F5, F6)
- Streaming Messages API uses server-sent events (SSE). Typical lifecycle is `message_start`, content block start/delta/stop events, one or more `message_delta` events, then `message_stop`; `ping` and error events may also occur, and clients should tolerate new event types. (F7, F8)
- Fine-grained tool streaming can expose fragments of tool input earlier by skipping server-side JSON buffering and validation. Partial or invalid JSON is possible, including truncation at `max_tokens`; buffer fragments and guard parsing before executing side effects. (F9)
- Claude may emit several `tool_use` blocks in one assistant response. The application chooses whether to execute calls concurrently, sequentially, or in a mix; independent read-only work is usually a good candidate for parallel execution. Return a matching result for each call in one next user message, ordered before any text content. (F10)
- `disable_parallel_tool_use: true` in `tool_choice` constrains `auto` to at most one tool call per response. For `any` or `tool` it means exactly one call; those forced-choice types are not supported by some current models, so check the model-specific tool docs before relying on them. (F11)
- Prompt cache breakpoints define the prefix written to cache. Put a breakpoint on the final block whose cumulative prefix stays identical across requests; putting it after a per-request timestamp or user query causes misses. Up to four breakpoints are supported, and they can partition content with different change cadences. (F12)
- Cache TTL can be `5m` or `1h`; 5 minutes is the default, and the 1-hour TTL has a higher write cost. Up to four breakpoints can mark prefixes; TTL counts from the request that writes or reads the entry, so a long streaming response consumes part of that cache lifetime. A cache hit reduces processing time and cost but exact prefix matching matters. (F13, F14, F26, F27)
- With adaptive thinking, Claude decides per request whether and how much to think. `output_config.effort` is the primary control; reducing effort can reduce thinking and other output tokens, usually trading away some capability. Effort levels are model-specific and have different defaults/calibration, so run a fresh quality/latency sweep after model changes. (F15, F16)
- Current model guidance: Haiku 5.5 is positioned for high-volume, latency-sensitive classification/extraction/routing and is rated fastest in the current lineup; Sonnet 5.5 is positioned as a speed/intelligence balance and rated fast; Opus 5.5 is positioned for long-running agentic coding and knowledge work and rated moderate. Use workload evals rather than family names alone to select the fastest model that meets quality. (F17, F24)
- Fast mode changes inference configuration for supported models and is documented as up to 2.5× higher OTPS. Its benefit is focused on output rate, not TTFT; it works with streaming. It is a premium-priced option and capacity can return 429/529. (F18, F19)
- Priority Tier is a service-tier arrangement intended to prioritize requests and reduce overload errors during peaks, with a 99.5% uptime target on existing commitments. The docs now say capacity commitments are no longer available for purchase; requests outside commitment capacity fall back to standard. This is availability/queue protection, not an output-generation speed control. (F20, F21)
- Tail latency matters even when average performance is acceptable. Track percentile latency and errors by successful/failed request; queueing contributes directly to latency, and overly long deadlines can leave resources occupied after the caller has lost interest. (F22, F23)

## Exact API / config details

- Messages API streaming: Python SDK `client.messages.stream(...)` or raw HTTP request with `"stream": true`; the connection carries SSE. The SDK can also stream internally and return a complete object via `stream.get_final_message()`. Events include `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, and `message_stop`; tolerate `ping`, `error`, and unknown event types. (F7, F8, F25)
- Fine-grained tool input streaming: set tool definition field `eager_input_streaming: true` and enable request streaming. It is optional and applies to user-defined tools; `false` keeps standard buffered streaming. Incremental events carry `input_json_delta` / `partial_json`; use accumulated/validated input before dispatch. (F9)
- Parallel tool handling: assistant content may contain multiple `tool_use` blocks; invoke each using its own `id`, then post one `role: "user"` message containing all `{type: "tool_result", tool_use_id: ...}` blocks. Every result must correspond to a call and precede text blocks. (F10)
- Disable parallel calls with `tool_choice={"type":"auto","disable_parallel_tool_use":true}`. This is not a top-level field. For `auto`, it allows zero or one tool; for `any` or `tool`, it forces exactly one (where supported). (F11)
- Cache controls: `cache_control: {"type":"ephemeral"}`; optional `ttl: "5m" | "1h"`, default `5m`. Place block-level markers on the end of stable prefix, or top-level for automatic breakpoint placement. Cache writes happen at marked points; changing content at/before a marker changes the prefix hash. (F12, F13)
- Effort: `output_config={"effort":"low"}` (also documented levels include `medium`, `high`, `xhigh`, and `max`, subject to model support). On adaptive-thinking models, thinking is default/on and effort governs how much work Claude does; do not assume `thinking: {"type":"disabled"}` is valid for every model. Check current per-model docs. (F15, F16)
- Fast mode: Messages API parameter `speed="fast"`; response `usage.speed` indicates `"fast"` or `"standard"`. Availability and beta-header requirements vary by model/platform. Fast mode is unavailable with Batch API and Priority Tier commitment; fast-mode 429 may include `retry-after`, while 529 can indicate capacity/overload. (F18, F19)
- Priority: request field `service_tier="auto"` (default) uses committed Priority capacity when available and falls back; `"standard_only"` restricts to standard. Inspect `usage.service_tier` and the documented `anthropic-priority-*` response headers to confirm actual assignment/headroom. As of this packet date, no new Priority capacity commitments are offered. Model eligibility is version-sensitive. (F20, F21)
- API-level timeout/cancellation syntax depends on the HTTP client/SDK and deployment gateway; no single Claude Messages API deadline/cancellation parameter was verified in the cited docs. Enforce an application deadline around the full agent operation and propagate remaining budget to tools; aborting a local stream should close/cancel the client-side request where supported. (F23; engineering guidance is inference)

## Practitioner reasoning

- [INFERENCE] Decompose end-to-end latency into admission/queue wait, each Claude call’s TTFT, model generation, each tool’s execution, network/serialization, and application rendering. Record both per-span timings and task-level p50/p90/p95/p99; a single API duration hides whether a target misses because of first response, long generation, sequential tool chains, or tailing tools. Treat failed calls separately but include their duration in service health.
- [INFERENCE] For an agent loop, the critical path is the sum of sequential model round trips and serial dependencies, plus the longest branch within each parallel batch. If three independent lookups take 180, 420, and 260 ms concurrently, the join waits about 420 ms, not 860 ms. Add queueing and tool service tails rather than assuming averages add up to a p95.
- [INFERENCE] Streaming is most valuable where TTFT/perceived wait matters or where output can be consumed progressively. Preserve a final completion signal: partial text is not proof that the response finished, and partial tool JSON must never trigger non-idempotent actions before complete parsing/validation.
- [INFERENCE] Parallelize only independent operations. Fan out read-only MCP calls when safe; serialize writes, operations with shared mutable state, and dependent calls. Bound concurrency to avoid saturating the tool service, connection pool, rate limits, or caller. More simultaneous tools can lower the critical path while increasing resource contention and tail risk.
- [INFERENCE] Place explicit cache breakpoints after stable system instructions, shared examples, and stable tool/context definitions. Keep per-user text, timestamps, OAuth credentials, and request-specific context after the stable checkpoint; do not cache secrets or assume caching removes all prompt processing. For a long agent run with gaps over five minutes, consider the one-hour TTL and compare write premium with expected reuse. Keep a stable prefix ahead of variable suffixes.
- [INFERENCE] Diagnose against the actual objective before tuning: high TTFT suggests queues, model/prompt prefill, cache misses, or reasoning before the first visible token; high TTLT with acceptable TTFT suggests output volume, low OTPS, tool duration, or extra rounds. A slow completion caused by long reasoning is not repaired by token streaming alone.
- [INFERENCE] Prefer the least expensive/faster model and effort setting that passes task-specific quality checks. Lower effort can reduce thought and tool-call verbosity; if it causes omissions, retries, or extra agent turns, total latency can rise. Evaluate the whole task (success, calls, tokens, p50/p95), not only one completion’s raw token rate.
- [INFERENCE] Use fast mode when OTPS dominates the user’s wait and supported capacity/pricing work; it will not solve a queue/TTFT bottleneck. Priority Tier may help an eligible existing commitment avoid overloaded waits, but does not guarantee a task TTLT or improve model generation rate.
- [INFERENCE] Set an end-to-end deadline from the caller’s remaining budget. Reserve time for final synthesis and delivery, stop launching work after the budget expires, and cancel or abandon stale branches. Retries must fit inside the same deadline; retrying after the user has timed out can amplify load. Place bounded queues before fan-out so saturation does not turn into unbounded latency.

## Worked example(s)

**Scenario:** A customer support agent has a 4.0-second p95 target for a complete answer and a 0.8-second p95 target for visible first response. It uses Sonnet 5.5, a 24k-token prompt, two independent MCP lookups (account status and order tracking), then a synthesis response. Use these illustrative measurements, not service guarantees:

| Critical path component | Before | Tuned estimate |
|---|---:|---:|
| Queue + Claude first response (TTFT) | 0.90 s | 0.55 s (stable 20k prefix cached; low/medium effort selected by eval) |
| Parallel lookup join | 0.70 s (serialized: 0.42 + 0.28) | 0.42 s (max of parallel 0.42 and 0.28) |
| Follow-up Claude call TTFT | 0.90 s | 0.55 s |
| 240 output tokens at measured 120 OTPS | 2.00 s | 1.50 s at 160 OTPS after shorter answer; output begins streaming immediately |
| App/network/serialization overhead | 0.35 s | 0.25 s |
| **Total task time** | **4.85 s** | **3.27 s** |

The estimate uses `2 × 0.55 + 0.42 + 240/160 + 0.25 = 3.27 s`. A stream can show first content after the first TTFT (target 0.55 s) while final delivery completes around 3.27 s; do not call the first token the total-latency result. In practice the tool join, cache-hit rate, actual token count, and p95 values must be measured. If model emits a tool call instead of useful text first, track first user-visible content separately from protocol-level first event. Model: conceptual scenario; arithmetic is runnable by hand, not SDK code.

## Diagram spec

- Type: sequence / critical-path timeline.
- Actors: Client, API gateway/queue, Claude Messages API, orchestrator, MCP account tool, MCP order tool.
- Edges: Client submits request → gateway queue → Claude call 1 TTFT/streamed tool-use events → orchestrator dispatches both independent MCP calls concurrently → each sends one `tool_result` and joins at slower branch → Claude call 2 streams answer → `message_stop` → client marks complete. Show the shorter MCP branch waiting at a join; label total time as queue + TTFT₁ + max(tool₁, tool₂) + TTFT₂ + generated tokens/OTPS + overhead. Add a dotted alternative sequential edge to show the sum of tool durations.
- Caption: “End-to-end completion follows the dependency graph’s critical path; streaming exposes partial output sooner, while parallel calls shorten only independent branches.”

## Exam lens

- [Editorial inference] If a prompt asks for a faster first visible response, distinguish TTFT causes from output-token throughput; streaming changes visibility, caching/prompt reduction/model/effort may affect first-token delay.
- [Editorial inference] If independent tools are returned in one assistant turn, dispatch concurrently and return all matching tool results together; do not serialize them without a dependency or safety reason.
- [Editorial inference] If total latency is dominated by many calls or tools, tune the critical path and reduce round trips; a faster OTPS mode will not remove sequential dependencies.
- [Editorial inference] If a repeated prefix misses cache, move checkpoint to the last stable block and use longer TTL only when reuse timing justifies its cost.

## Common mistakes

- Treating TTFT, TTLT, and OTPS as interchangeable or claiming streaming makes completion faster by definition.
- Measuring only the model HTTP request while excluding queue wait, MCP duration, retries, and orchestration gaps.
- Returning parallel tool results in separate user messages or mismatching `tool_use_id` values.
- Using fine-grained partial JSON as executable input before completion and validation.
- Placing the cache checkpoint after volatile per-request content, or expecting prompt caching to increase output-token generation rate.
- Assuming low effort, Haiku, fast mode, or Priority Tier is universally faster for the full agent task; a quality loss or eligibility/capacity limit can change the result.
- Applying a timeout only to the outer HTTP call while child tool calls and retries continue consuming work after the caller’s deadline.

## Self-check

1. The stream’s first token arrives at 0.6 s, then 300 tokens take 1.5 s to generate, followed by 0.4 s of tool/network work. Is latency 0.6 s? **No.** TTFT is 0.6 s; total task time includes generation and non-model work (approximately 2.5 s, ignoring overlap).
2. Claude returns three independent read-only `tool_use` blocks. What should the orchestrator send on the next turn? **One user message with three `tool_result` blocks, each matched by `tool_use_id`, after executing the calls concurrently if safe.**
3. A repeated 15k-token prompt misses cache whenever a timestamp changes. Where should the checkpoint go? **At the last block before the timestamp, so the cached cumulative prefix is identical across requests.**

## Unresolved

- Anthropic’s public docs do not provide a universal numeric TTFT/TTLT SLO or guaranteed model latency; workload measurements and percentile targets must be established by the application.
- No general Messages API cancellation/deadline field was verified. Client SDK and gateway abort behavior varies, so validate the chosen runtime’s cancellation propagation.
- Priority Tier eligibility has changed over time and excludes some newly released models in current documentation; consult the live service-tier page and the organization’s contract. It is not a generally purchasable option as of the documentation read for this packet.
- “Fast mode up to 2.5×” is a documented upper bound on output tokens per second for supported models, not a per-request SLA or TTFT guarantee.
