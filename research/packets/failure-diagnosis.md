# 4.1 Complex Failure Diagnosis

Official objective:

> Analyzing evidence from complex production failures, including multi-turn, multi-agent, and non-deterministic failures, to isolate the problem origin among model output, agent harness, tools, and data, including model refusals as a failure class and retrieval-grounding failures.

## Scope map

| Official sub-objective | Packet section(s) |
|---|---|
| Analyzing evidence from complex production failures | Core facts; Exact API / config details; Practitioner reasoning; Worked examples |
| Multi-turn failures | Core facts; Exact API / config details; Practitioner reasoning |
| Multi-agent failures | Core facts; Practitioner reasoning; Troubleshooting tree |
| Non-deterministic failures | Core facts; Exact API / config details; Practitioner reasoning |
| Isolate problem origin among model output, agent harness, tools, and data | Practitioner reasoning; Troubleshooting tree |
| Model refusals as a failure class | Core facts; Exact API / config details; Troubleshooting tree |
| Retrieval-grounding failures | Core facts; Worked examples; Troubleshooting tree |

## Core facts

- The Messages API response includes a `stop_reason`; documented values distinguish natural completion, output cap, custom stop, tool handoff, paused server-tool loop, refusal, and context-window overflow. Treat this as control-flow evidence, not a quality score. (F5, F8)
- For tool calls, match every `tool_result.tool_use_id` to the assistant `tool_use.id`. Missing results or putting text before results are documented causes of an unresolved-tool request failure (400). (F1, F3)
- When Claude emits multiple parallel client tool calls, send their corresponding results together in one user message. Split result messages alter the conversation pattern Claude sees and can suppress parallel tool use. (F2)
- `pause_turn` denotes a paused server-side loop. Continue by replaying the assistant response unchanged and retaining the same tools; do not put a new user message after the paused assistant turn. Client-executed tool calls instead end in `tool_use`. (F4, F24)
- In tool and multi-turn conversations, thinking and redacted-thinking blocks in the latest assistant turn may be signature-bound. Rewriting or omitting those blocks can yield a 400; send the assistant turn back verbatim. (F6)
- `max_tokens` means the request’s output cap or model maximum was exceeded. In an agent trace, inspect whether the response ended before the expected tool-use/result boundary; truncation can leave the application with incomplete work even though the API request succeeded. (F5, F8)
- Record the complete response envelope, including `id`, `model`, `stop_reason`, `stop_sequence`, `usage`, `content` block types, and request correlation ID. The API usage counts are useful operational evidence, but the API notes token counts need not map one-to-one to visible content. (F7, F8, F22)
- A classifier refusal is an independent failure class: it returns a successful HTTP 200 with `stop_reason: "refusal"` and structured `stop_details`. In streaming, `stop_details` arrives with `stop_reason` on `message_delta`; partial text may have already streamed. Track refusals separately from HTTP error rates and avoid showing partial output as a completed answer. (F11, F12, F27)
- A refusal can originate from a classifier, validation such as input/copyright checks, or a model-generated textual refusal; those cases have different evidence and handling. (F11)
- Retrieval and generation should be evaluated separately. If expected evidence is absent from retrieved chunks, investigate query construction, filters, ranking, or corpus freshness; if relevant evidence is present but the answer is unsupported, investigate prompt grounding and model behavior. (F14)
- Messages API `search_result` blocks can pass retrieved content with source/title attribution, and citations can be returned when citations are enabled. This helps inspect whether a response was grounded in the evidence actually supplied. (F13)
- Compaction replaces earlier conversation material with a summary. Thinking blocks before a compaction block do not carry forward; operationally, treat the summary as a lossy boundary and explicitly preserve constraints, decisions, and unresolved requirements that later turns must obey. (F15)
- A model ID can pin the model snapshot, but serving infrastructure can still change and create minor behavior differences with the same ID and weights. Log the exact model identifier and run regression comparisons when behavior shifts. (F10)
- Sampling configuration is version-sensitive: `temperature=0` does not guarantee determinism, while API version `2026-10-21` rejects requests containing `temperature`, `top_p`, or `top_k` at any value. Repeated fixed-input trials remain the practical way to measure variation; do not turn sampling parameters on as a diagnostic without verifying model and API compatibility. (F9, F30)
- For multi-agent Managed Agents sessions, the console session viewer exposes usage and a timeline with a lane for each thread. Align per-thread events by timestamps and tool/request IDs before attributing a shared failure to one agent. (F21)
- Managed Agents permission policy can produce a tool result with `is_error: true` and an explicit permission-denied message. That signal should be separated from a tool implementation exception or a network failure. (F20)
- Claude Code’s `/doctor` checks installation, settings, extensions, and context usage; `/mcp` reports MCP server status. `/debug` diagnoses runtime issues, `claude --debug` enables capture from session start, and `/export` saves the current conversation as plain text. Debug files default to `~/.claude/debug/<session-id>.txt` or a path set by `CLAUDE_CODE_DEBUG_LOGS_DIR`. (F16, F17, F25, F26)
- Long requests can fail if an intermediary drops an idle connection; the API documentation recommends streaming or batches for long-running work. A 401 `authentication_error` instead points to API-key or AWS credentials/SigV4 problems. (F28, F29)
- The Anthropic Python SDK can emit request spans through OpenTelemetry and can log request/response details; the SDK tool runner’s Python logging can include a tool exception stack trace. (F18, F19)

## Exact API / config details

| Evidence or control | Verified detail | Citation |
|---|---|---|
| Tool result pairing | `tool_result.tool_use_id` echoes the `tool_use.id`; send one result per client `tool_use`. In the user content array, result blocks come first. | F1, F3 |
| Parallel results | Put all results for a parallel tool batch in the same `user` message. | F2 |
| Server loop | On `pause_turn`, append the full paused response as an `assistant` message unchanged, retain the previous `tools`, and do not append a new user message. | F4 |
| Stop reasons | Documented `stop_reason` strings include `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal`, and `model_context_window_exceeded`. | F5, F8 |
| Refusal stream | Read `event.type == "message_delta"`, then `event.delta.stop_reason`; `stop_details` is delivered on that event. | F11 |
| Sampling compatibility | API version `2026-10-21` rejects any request containing `temperature`, `top_p`, or `top_k`. | F30 |
| Correlation | Claude API response header: `request-id`. Preserve it with the message ID and your internal trace ID. | F22 |
| Python SDK logging/tracing | Set `ANTHROPIC_LOG=debug` or `info`; register an OpenTelemetry tracer provider to have the SDK emit one span per request. | F18 |
| Claude Code diagnostic commands | `/doctor`, `/mcp`, `/debug`, `claude --debug`, `/export`; debug log default path is `~/.claude/debug/<session-id>.txt` or `CLAUDE_CODE_DEBUG_LOGS_DIR`. | F16, F17, F25, F26 |
| TypeScript SDK logging | Client option `logLevel: "debug"` or `ANTHROPIC_LOG`; at debug, request and response headers/bodies may be logged. | F23 |

The quoted sources do not establish one universal trace schema for arbitrary custom agent harnesses, nor a single cross-platform diagnostic command for OAuth, DNS, TLS, or proxy failures. Treat those as application-level evidence and use the platform’s own request IDs and error payloads where available; do not infer a model failure from a tool timeout alone. (F28, F29) [INFERENCE]

## Practitioner reasoning

### Triage sequence

1. **Freeze the incident sample.** Save the exact input messages and system prompt, model ID, API version and beta headers, tool schemas, orchestration configuration, retrieval query and returned document IDs, and the full assistant response including non-text blocks. Redact secrets only after preserving a secure original. Correlate with `request-id`, your trace ID, session ID, agent/thread ID, and tool-use IDs. Request IDs are returned for API correlation; the rest are harness evidence to preserve. (F22) [INFERENCE]
2. **Classify the stop boundary.** A 4xx validation response points first to request shape, configuration, permissions, or unsupported parameters; a successful response with `tool_use` or `pause_turn` points to loop progression; `max_tokens` and `model_context_window_exceeded` indicate capacity boundaries; `refusal` indicates the safety refusal path. Do not label all unexpected results “model hallucination.” (F1, F5, F8, F12) [INFERENCE]
3. **Reconstruct the transcript as a state machine.** For each assistant turn, list every `tool_use` id and confirm a paired result immediately follows, the result blocks come first, and a parallel batch is returned in one user message. For server-tool turns, distinguish unresolved server calls from client calls, and honor `pause_turn` continuation. If thinking was returned, compare the replayed assistant content byte-for-byte with the saved response. (F1–F4, F6) [INFERENCE]
4. **Separate tool, permission, and network hypotheses.** Compare the model’s requested tool name and arguments with actual dispatch; then inspect tool start/end time, raw result or exception, OAuth principal/scopes, policy decision, DNS/TLS/connect/read timeout, and upstream status. Explicit permission-denied results support a permissions hypothesis; an exception stack trace supports tool execution; no request reaching the service plus a transport error supports network or client-side failure. A platform-level 401 suggests credentials/authentication; a long-call idle timeout can reflect an intermediary connection dropping. These tests are diagnostic reasoning, not one universal Anthropic error contract. (F19, F20, F28, F29) [INFERENCE]
5. **Separate retrieval from grounding.** Replay the exact query against the same index snapshot and filters; inspect candidate IDs, scores, selected chunks, freshness, ACL filtering, and truncation. Then ask whether the answer’s claims are entailed by those chunks. Missing evidence is retrieval/data-side; present evidence ignored or overstated is prompt/model-side. Measure retrieval and end-to-end answer quality separately. (F13, F14) [INFERENCE]
6. **Test nondeterministic symptoms statistically.** Replay an unchanged request multiple times and retain the distribution of tool choice, refusal, answer correctness, and latency. `temperature=0` still does not guarantee determinism; API version `2026-10-21` rejects sampling parameters at any value. Do not add them as a diagnostic knob without checking the exact model and API version. (F9, F30) [INFERENCE]
7. **Check context and version boundaries.** Compare pre- and post-compaction histories and verify summary retention of hard constraints. Compare exact model IDs, tool definitions, prompts, SDK/harness versions, and deployment timestamps. An unchanged model ID does not rule out serving-infrastructure change. (F10, F15) [INFERENCE]

### Symptom → evidence → hypothesis → discriminating test

| Symptom | Evidence to collect | Leading hypothesis | Discriminating test |
|---|---|---|---|
| HTTP 400 after tool call | Error body, request ID, last assistant blocks, `tool_use.id`, all next user blocks | Harness omitted a result, mismatched ID, placed text first, or mutated thinking | Validate the serialized transcript against the exact returned assistant content; submit a minimal repaired continuation with one result per ID. (F1, F3, F6) |
| Tool is called but never completes; long loop appears stuck | `stop_reason`, server/client tool block types, messages, tool registry for next call | `pause_turn` mishandled, tool missing on continuation, or harness waits for a client result for server tool | Replay paused assistant content unchanged with same tools and no user turn; cap continuation count. (F4, F24) |
| Parallel work becomes sequential or one result is ignored | Assistant parallel `tool_use` blocks and following user-message boundaries | Harness split results into separate messages | Return all results in one user content array and compare subsequent tool-call pattern. (F2) |
| Correct tool call, failed action | Tool arguments, dispatch route, exception/stack, service response, auth identity/scopes, policy result | Tool implementation, permission denial, or network/auth fault | Invoke the same tool input outside the agent using the same identity; compare raw service outcome and policy decision. (F19, F20) [INFERENCE] |
| Correct docs exist but answer is unsupported | Query, index version, filters, ranked candidate IDs, exact chunks sent, answer/citations | Retrieval miss, stale or filtered data, truncation, or grounding failure | Freeze supplied chunks; first score retrieval alone, then test answer entailment with those exact chunks. (F13, F14) [INFERENCE] |
| A constraint disappears after many turns | Full transcript, compaction blocks, summary, token usage, original instruction | Context compaction summary omitted a constraint | Replay from original history and from the stored summary with a canary question that requires the constraint; inspect summary content. (F15) [INFERENCE] |
| Failure is intermittent on apparently identical requests | Exact request hash, model ID, API version, tool/data versions, repeated outputs and stop reasons | Sampling variation, hidden changing state, infrastructure, retrieval/service nondeterminism | Run a small fixed-input batch (for example 20 trials), freeze tool and retrieval outputs, and compare variance; then restore live dependencies one at a time. (F9, F10) [INFERENCE] |
| User sees a partial streamed answer and then a refusal | SSE event sequence, final `message_delta`, streamed content already emitted | Classifier refusal arrived after partial content | Buffer user-visible output until terminal state; record refusal separately and apply the configured refusal fallback/reset behavior. (F11, F12) [INFERENCE] |

## Worked example(s)

### Worked example: missing invoice tool result in a multi-agent run

**Illustrative pseudocode, not runnable; no SDK version assumed.** A coordinator delegates invoice lookup to two worker threads, which return two client tool calls. The harness executes both calls, but accidentally sends two separate user messages. On one retry it also drops a result after a timeout. The final request returns HTTP 400 and the user sees a generic “agent failed” message.

Capture a redacted incident bundle keyed by `(session_id, thread_id, request-id)` containing: the original assistant message verbatim; `stop_reason`; every content block type and `tool_use.id`; each tool invocation’s principal, arguments hash, start/end, timeout/status, and result; and the exact next Messages API request body. For each assistant `tool_use`, verify a one-to-one result with the same ID. Combine the concurrent results in one `user` message, with `tool_result` blocks before any explanatory text. If the assistant response includes thinking blocks, replay the complete assistant turn unchanged. (F1–F3, F6, F21, F22)

```text
assistant: tool_use(id=a1), tool_use(id=b1); stop_reason=tool_use
tool services: a1 succeeded (42 ms); b1 succeeded (61 ms)
bad harness transcript: user(tool_result a1), user(tool_result b1)
corrected transcript: user(tool_result a1, tool_result b1)
```

First replay the captured request with only the transcript corrected and cached tool outputs; do not invoke the write-capable tool again. If the 400 disappears, the harness history serialization was causal. If it remains, compare thinking blocks and tool definitions to the captured request, then validate tool-specific service/auth/network behavior. Re-run a small sample with live dependencies only after the replay establishes the API conversation is valid. [INFERENCE]

### Worked example: retrieval versus unsupported answer

For an answer that states a renewal date absent from the cited text, preserve the exact query, index snapshot, ACL filters, top-k candidate IDs, scores, and chunks actually sent to Claude. If the relevant renewal clause was not retrieved, correct retrieval/query/filtering and measure recall. If it was retrieved, verify whether the clause was truncated or contradicted elsewhere; then examine instructions and the answer’s entailment. Use a frozen set of chunks to isolate generation from the retrieval system. (F13, F14) [INFERENCE]

## Diagram spec

**Type:** tree. Start at “unexpected production outcome”; branch to transport/API status, `stop_reason`, harness transcript integrity, tool/policy/service result, retrieval evidence, then model behavior. Each leaf maps to a discriminating replay: exact request replay, corrected message pairing, tool invocation outside the agent, frozen retrieval chunks, or repeated fixed-input trials. **Caption:** Use the earliest observable divergence in the request-to-tool-to-result chain to locate the responsible layer.

## Exam lens

- **Editorial inference:** A 400 after tool use plus a missing or misplaced `tool_result` is a harness serialization defect; replaying with correct block order tests it directly. (F1, F3)
- **Editorial inference:** A `pause_turn` should be continued as an assistant response with the same tools; adding a user prompt or treating it like a client tool call can strand server-side work. (F4, F24)
- **Editorial inference:** A refusal is a successful HTTP response with its own stop reason, so monitor it as a quality/policy event and handle partial streaming deliberately. (F11, F12)
- **Editorial inference:** In RAG, inspect the retrieved evidence before blaming the model; retrieval recall and answer grounding are separate measurements. (F13, F14)

## Common mistakes

- Treating every HTTP 200 as a complete answer without checking `stop_reason`.
- Logging only rendered assistant text and losing `tool_use` IDs, results, thinking blocks, usage, or request correlation.
- Reconstructing an assistant tool-use turn from selected text instead of replaying the returned structure.
- Sending each parallel result as its own user turn.
- Treating a permission denial or network timeout as evidence that Claude chose the wrong tool.
- Calling a groundedness failure when the relevant document never reached the model.
- Assuming the same model ID proves serving behavior has not changed.
- Assuming `temperature=0` guarantees an identical answer.
- Allowing partial streamed content to appear final before checking for a refusal stop.
- Depending on compaction while failing to preserve constraints that later turns must follow.

## Self-check

1. **The model returned two `tool_use` blocks; your harness sent each result in a different user message and the next response omitted the second result. What is the first discriminating fix?** Return both matching results in one user message, results first, then compare the exact serialized history. (F1–F3)
2. **The API returned HTTP 200 with partial streamed text and `stop_reason: refusal`. Is this an HTTP/tool failure?** No. Record a refusal event, do not present partial output as final, reset context before continuing, and use a different model if retrying. (F11, F12, F27)
3. **A RAG answer is wrong. What two measurements isolate data retrieval from generation?** Retrieval quality against expected evidence, then end-to-end answer accuracy/grounding using the retrieved chunks. (F13, F14)

## Unresolved

- The reviewed sources do not provide a general-purpose Anthropic troubleshooting taxonomy for arbitrary custom OAuth, DNS, TLS, proxy, or network failures. Attribute these using the deployed tool’s transport and identity telemetry; do not assume a universal Anthropic field or error string.
- The packet does not prescribe a universal number of nondeterminism trials or confidence threshold. The suggested 20-trial replay is an engineering example, not an Anthropic requirement.
- Claude Code `/export` saves the current conversation as plain text, but a complete structured local transcript schema was not verified. Managed Agents session observability documents a JSON transcript inspector; that applies to Managed Agents rather than arbitrary Claude Code or custom harness sessions. (F21, F25)
