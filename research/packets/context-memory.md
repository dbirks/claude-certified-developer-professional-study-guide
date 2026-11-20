# 1.4 Context and Memory Architecture

> Evaluating context-policy options for long-running agents approaching context limits or cost ceilings, including context compaction and editing, persistent memory, cache-safe instruction changes mid-conversation, and tool-use techniques that keep large tool catalogs out of the context window.

## Scope map

- **Long-running agents approaching context limits or cost ceilings**: Core facts (context windows, 1M defaults/pricing, context rot, overflow, token counting, cache reuse vs. capacity reduction); Practitioner reasoning (decision table).
- **Context compaction and editing**: Core facts & Exact API details (`clear_tool_uses_20250919`, `clear_thinking_20251015`, server-side on-demand `compact-2026-09-04` vs. threshold `compact-2026-01-12` vs. deprecated SDK `compaction_control` vs. Claude Code `/compact` and auto-compact); Practitioner reasoning (what must survive summarization, detecting constraint loss).
- **Persistent memory**: Core facts & Exact API details (`memory_20250818` client-side `/memories` protocol, path traversal security, Claude Code `CLAUDE.md` / `MEMORY.md`, Agent SDK sessions).
- **Cache-safe instruction changes mid-conversation**: Core facts & Exact API details (prefix hierarchy `tools` → `system` → `messages`, lookback window, invalidation matrix, appending `role: "system"` in `messages`, `clear_at`, `tool_addition`/`tool_removal`, Claude Code message-append patterns).
- **Tool-use techniques that keep large tool catalogs out of the context window**: Core facts & Exact API details (`tool_search_tool_regex_20251119` / `tool_search_tool_bm25_20251119` with `defer_loading: true`, programmatic tool calling `allowed_callers`, `manage-tool-context` composition).

## Core facts

- **Context rot**: Recall and accuracy degrade as context length grows, so curating high-signal tokens matters even inside 1M windows (F1).
- **1M context defaults & pricing**: Fable 5–5.2, Mythos 5–5.2/Preview, Opus 4.6–5.5, Sonnet 4.6–5.5, and Haiku 5.5 default to a 1M context window (128k max output) with no beta header and standard per-token pricing across the full window—except **Claude Haiku 5.5**, which charges higher rates when total prompt length (including `cache_read_input_tokens` and `cache_creation_input_tokens`) exceeds 100k tokens (F3, F8). Older/deprecated models (Sonnet 4.5, Opus 4.5, Haiku 4.5) have 200k windows.
- **Cache reuse ≠ context-window reduction**: Prompt caching cuts token cost (0.025×–0.1× reads) and TTFT, but `cache_read_input_tokens` and `cache_creation_input_tokens` still occupy the context window and count toward context limits and context rot (F2, F4).
- **Overflow & budgets**: Input exceeding the window returns HTTP 400 `invalid_request_error` ("prompt is too long") (F5). On Claude 4.5+, `input + max_tokens` exceeding the window is accepted and stops with `stop_reason: "model_context_window_exceeded"` if generation hits the boundary (F6). Sonnet 5, Sonnet 4.6/4.5, and Haiku 4.5 receive automatic `<budget:token_budget>` / `<system_warning>` tags; Opus 4.7+, Sonnet 5.5, Haiku 5.5, Fable, and Mythos use explicit beta `task_budget` instead (F7).
- **Token counting & tokenizer shift**: `POST /v1/messages/count_tokens` is free (separate tier RPM limits) and previews `context_management` (F9). Because Claude 4.7+ and Mythos Preview use a newer tokenizer producing ~30% more tokens for identical text, always count against the target model ID (F10).
- **Server-side context editing**: `clear_tool_uses_20250919` and `clear_thinking_20251015` edit prompts server-side while keeping client history intact (F11); `clear_thinking_20251015` must appear first when combined (F13). Tool result clearing invalidates the cache prefix, so use `clear_at_least` to avoid cache churn (F12).
- **Server-side compaction vs. SDK / Claude Code**: Anthropic recommends **on-demand compaction** (`compact-2026-09-04`) over **threshold compaction** (`compact-2026-01-12`) wherever available (F15, F16). Billable compaction usage is reported in `usage.iterations`, not top-level `input_tokens`/`output_tokens` (F18). Client-side SDK `compaction_control` is deprecated in TS/Ruby `tool_runner` and removed in Python SDK v1.0 (F14). Claude Code auto-compacts native 1M sessions at ~967K tokens by default (F33).
- **Persistent memory**: `memory_20250818` executes client-side against `/memories` paths under application storage and path-traversal enforcement (F20); pairing it with compaction preserves critical state across summaries (F21).
- **Prompt caching hierarchy & invalidation**: Prefixes hash in strict `tools` → `system` → `messages` order (max 4 breakpoints, 20-block lookback) (F22, F23). Prompts below per-model minimums (512–4,096 tokens) silently skip caching without error (F24). Editing `tools` invalidates tools, system, and messages; toggling web search/citations or `speed: "fast"` invalidates system and messages; changing `tool_choice` or images invalidates messages.
- **Cache-safe mid-conversation changes**: Append a `role: "system"` message to `messages` after the cache breakpoint rather than editing top-level `system` (supported on Opus 4.8/5/5.5, Sonnet 5.5, Haiku 5.5, Fable/Mythos 5–5.2; not Sonnet 5) (F25). Use `tool_addition` / `tool_removal` blocks (`inline-tools-2026-09-15`) to change offered tools without mutating `tools` (F26). Never place untrusted external text in `role: "system"` (F27). Claude Code appends plan-mode and skill instructions as conversation messages to keep caches intact (F35).
- **Large tool catalog mitigation**: Loading 30–50+ tools upfront degrades tool-selection accuracy and bloats context (F28). **Tool search** (`defer_loading: true`) excludes deferred schemas from the prefix and expands matches inline via `tool_reference`, preserving prompt caching and strict-mode grammar (F28, F29). **Programmatic tool calling** (`allowed_callers: ["code_execution_20260120"]`) runs multi-tool loops in a sandbox so intermediate `tool_result`s never enter context, cutting tokens 20–40% on 10–49 tool workloads (F30). All four tool-context levers compose cleanly (F31).
- **Summarization survival**: In Claude Code, project-root `CLAUDE.md` and `MEMORY.md` reload from disk after `/compact`, while `paths:`-scoped rules and subdirectory `CLAUDE.md` live in message history and are summarized away (F32). In the Messages API, summarized `role: "system"` messages stop applying after compaction and must be restated (F17). Tune compaction prompts for recall first, then precision (F34).

## Exact API / config details

### Token counting & Context windows
- **Token counting**: `POST /v1/messages/count_tokens` (`client.messages.count_tokens(...)`); accepts `model`, `system`, `messages`, `tools`, `context_management` (F9). Rejects server tools (except `advisor`), MCP connector, and URL/file `image`/`document` blocks with `invalid_request_error` (send base64 to count). Does not execute caching.
- **Total input token formula**: `total_input_tokens = cache_read_input_tokens + cache_creation_input_tokens + input_tokens` (F2).
- **Overflow**: `400 invalid_request_error` ("prompt is too long") if input exceeds window (F5); `stop_reason: "model_context_window_exceeded"` if `input + max_tokens` exceeds window and generation reaches the cap (Claude 4.5+; earlier models require `model-context-window-exceeded-2025-08-26`) (F6).
- **Task budgets**: Beta header `task-budgets-2026-03-13`; set `output_config: {"task_budget": {"type": "tokens", "total": 64000}}` (do **not** send `task_budget.remaining` on on-demand compaction requests—returns 400) (F7).

### Context editing (`context-management-2025-06-27`)
- **Header**: `anthropic-beta: context-management-2025-06-27` (F11). Zero data retention eligible; not HIPAA eligible.
- **Parameter**: `context_management: {"edits": [...]}`.
  - `clear_thinking_20251015`: must appear **first** if combined (F13). Option `keep`: `{"type": "thinking_turns", "value": N}` (N > 0, default `1`) or `"all"`. Note: without this strategy, Opus 4.5+, Sonnet 4.6+, Haiku 5.5, Fable, and Mythos keep all prior thinking by default; including it without `keep` sets `value: 1`.
  - `clear_tool_uses_20250919`: options `trigger` (`{"type": "input_tokens" | "tool_uses", "value": ...}`, default 100,000 input tokens), `keep` (`{"type": "tool_uses", "value": N}`, default 3), `clear_at_least` (minimum tokens to clear before activating—protects cache) (F12), `exclude_tools` (list of tool names never to clear), `clear_tool_inputs` (`bool`, default `false`).
- **Response telemetry**: `response.context_management.applied_edits` reports `cleared_thinking_turns` / `cleared_tool_uses` and `cleared_input_tokens` (in streaming, emitted on `message_delta`).

### Server-side compaction vs. SDK / Claude Code
- **On-demand compaction (recommended)**: Beta header `compact-2026-09-04` on both the summary request and every later request carrying the signed `compaction` block (F16). Top-level `compaction: {"type": "summarize", "instructions": "..."}` (max 16,384 chars; replaces default prompt). Returns a single `compaction` content block with `content` and cryptographic `signature` and `stop_reason: "compaction"`. Cannot combine `compaction` and `context_management` on one request. Errors: `400 compaction_block_misplaced` (summarized turns left ahead of block), `400 compaction_signature_invalid` / `compaction_content_mismatch`, `400 compaction_nothing_to_summarize`, `529 overloaded_error` (`compaction_unavailable`). SDK `tool_runner` helper: `runner.compact_before_next_turn()` (Python) / `compactBeforeNextTurn()` (TS).
- **Keep-tail & background compaction**: Both use `compact-2026-09-04` with no extra API params—leave recent turns out of the compaction request (cut cleanly so no `tool_use` lacks its `tool_result`), then prepend the returned block before kept/newly appended turns. On preserved-thinking models (Fable 5.1–5.2, Mythos 5.1–5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5), kept thinking stays valid iff compaction ran on a preserved-thinking model, kept turns follow directly unchanged, and `system`/`tools` stayed identical (can verify via `thinking-binding-controls-2026-08-01` + `prefix_mismatch_behavior: "error"`).
- **Threshold compaction**: Beta header `compact-2026-01-12`; `context_management.edits` entry `{"type": "compact_20260112", "trigger": {"type": "input_tokens", "value": 150000}, "pause_after_compaction": false, "instructions": "..."}`. Minimum `trigger.value` is `50000` (default `150000`). Uses the request's own model (cannot offload summary to Haiku). Always explicitly forbid tool calls in custom `instructions`, or the model may emit a tool call yielding `content: null` (F19). Put `cache_control: {"type": "ephemeral"}` at the end of `system` to avoid re-caching `system` on compaction.
- **Usage accounting**: Sum across `usage.iterations` (`type: "compaction"` + `type: "message"`), not top-level `usage.input_tokens`/`output_tokens` (F18).
- **SDK & Claude Code**: Client-side `compaction_control` removed in Python SDK v1.0, deprecated in TS/Ruby (F14). Claude Code auto-compacts 1M windows at ~967K tokens (F33); override via `/autocompact <N>`, `claude --autocompact <N>`, `autoCompactWindow` in settings, or `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (min `100000`), or disable via `DISABLE_AUTO_COMPACT=1` / `idleCompaction: false`.

### Persistent memory (`memory_20250818`) & Claude Code memory
- **Tool declaration**: `{"type": "memory_20250818", "name": "memory"}` (`name` must be `memory`; no schema needed; ZDR and HIPAA eligible) (F20).
- **Client-side commands**: `view` (`path`, optional `view_range`), `create` (`path`, `file_text`), `str_replace` (`path`, `old_str`, `new_str`), `insert` (`path`, `insert_line`, `insert_text`), `delete` (`path`), `rename` (`old_path`, `new_path`). Must canonicalize and constrain all paths to `/memories` (block `../`, URL-encoded `%2e%2e%2f`, etc.).
- **Claude Code memory**: `CLAUDE.md` (aim <200 lines; skipped >4 MiB; subdirectory/path-scoped rules capped at 40k chars on 200k windows and 150k–200k chars on 1M windows) and auto memory `MEMORY.md` (first 200 lines or 25 KB load at startup).

### Prompt caching & Cache-safe mid-conversation updates
- **Prefix order & breakpoints**: `tools` → `system` → `messages` (F22). Top-level `cache_control: {"type": "ephemeral"}` (automatic caching) or block-level `cache_control` (up to 4 breakpoints; 20-block lookback window; consecutive `tool_use` or `tool_result` blocks count as 1 lookback position) (F23).
- **TTL & pricing multipliers**: `5m` write = 1.25× base input; `1h` write (`ttl: "1h"`) = 2× base input; cache read = 0.1× on most models, **0.05×** on Opus 5.5 / Sonnet 5.5, **0.025×** on Fable 5.1–5.2 / Mythos 5.1–5.2. Minimum cacheable prefix: **512 tokens** (Fable/Mythos 5–5.2, Opus 5/5.5, Sonnet 5.5, Haiku 5.5), **1,024** (Opus 4.8, Sonnet 5/4.6/4.5), **2,048** (Opus 4.7, Mythos Preview), **4,096** (Opus 4.6/4.5, Haiku 4.5) (F24).
- **Mid-conversation system messages**: Append `{"role": "system", "content": "..."}` in `messages` (or `system.message` event in Managed Agents) (F25). Must immediately follow a `user` turn (including `tool_result` turns) or an `assistant` turn ending in a server tool result; cannot sit first in `messages` or between `tool_use` and `tool_result` (returns 400). Leave sent system messages unchanged on later turns.
- **Turn-scoped reminder**: Beta `mid-conversation-system-clear-at-2026-08-21`; `{"role": "system", "clear_at": "next_user_message", "content": "..."}` (text-only; no `tool_addition`, `tool_removal`, `output_config`, or `cache_control`; keep byte-for-byte in stored `messages` after cleared).
- **Mid-conversation tool changes**: Beta `inline-tools-2026-09-15` (first-party/AWS/GCP-Anthropic/Foundry; also supports inline tool definitions) or `mid-conversation-tool-changes-2026-07-01` (also Bedrock/GCP-Google). Include `{"type": "tool_addition", "tool": {"type": "tool_reference", "name": "..."}}` or `{"type": "tool_removal", ...}` (or `mcp_tool_reference` / `mcp_toolset_reference`) in a `role: "system"` message (F26). Unresolved names return 400 `tool_reference_unresolved`. Note: across compaction, `tool_addition`/`tool_removal` survive in the compaction block only if `inline-tools-2026-09-15` is sent on both the compaction request and subsequent requests.

### Tool search & Programmatic tool calling
- **Tool search**: Add `{"type": "tool_search_tool_regex_20251119", "name": "tool_search_tool_regex"}` (Python `re.search`, max 200 chars) or `tool_search_tool_bm25_20251119` (natural language, max 500 chars), keeping search tool + 3–5 core tools non-deferred and setting `"defer_loading": true` on catalog tools (up to 10,000 deferred tools; returns default 5 `tool_reference` blocks, `limit` 1–10,000) (F28). Keep `defer_loading: true` tools off `cache_control` (returns 400); put `cache_control` on the last non-deferred tool. Never send a `tool_result` for `server_tool_use` (`srvtoolu_...`). For MCP connector: `default_config: {"defer_loading": true}` on `mcp_toolset`. In Claude Code: `ENABLE_TOOL_SEARCH` (`true`/unset, `auto`, `auto:N`, `false`).
- **Programmatic tool calling (PTC)**: Enable code execution tool + set `"allowed_callers": ["code_execution_20260120"]` (prefer exclusive `"code_execution_20260120"` or `"direct"`, not both). Response `tool_use` carries `caller: {"type": "code_execution_20260120", "tool_id": "srvtoolu_..."}`. Pending tool call times out inside the container after ~4 minutes (`TimeoutError` after ~270s); always return the `container` ID on continuation requests; continuation `user` message must contain **only** text-only `tool_result` blocks (no `text`, images, or documents). Incompatible with `strict: true`, forced `tool_choice`, `disable_parallel_tool_use: true`, MCP connector tools, computer/browser toolsets, and recursive `$ref` schemas (`400 invalid_request_error`: `Circular $ref detected`).

## Practitioner reasoning

### Context-window reduction vs. cache reuse
A frequent production error is treating prompt caching as a substitute for context management. Prompt caching is a **billing and TTFT latency optimization**: a 400K-token cached prefix costs 0.05×–0.1× per read, which lowers spend, but all 400K tokens still sit inside the model's attention window, count against the 1M ceiling (and Haiku 5.5's 100K price cliff), and contribute to context rot (F1, F2, F4, F8). Conversely, context editing (`clear_tool_uses`) and compaction **reduce active context tokens** at the deliberate cost of invalidating the conversation-layer cache prefix once per edit/compaction (F12). **Tool search (`defer_loading`)** and **programmatic tool calling** are uniquely synergistic: they reduce active context tokens *without* breaking the stable prefix cache (F29, F30).

### Decision table of context policies

| Policy / Lever | Reduces Context Size? | Preserves Prefix Cache? | Key Trigger / Fit | Primary Failure Mode / Trade-off |
|---|---|---|---|---|
| **Prompt caching (`cache_control`)** | No (occupies window) | Yes (is the cache) | Any multi-turn agent with >512–4,096 token static prefix | Silent 0-hit misses from dynamic timestamps, unpinned `tools`, or >20-block lookback gap (F23, F24) |
| **Mid-conv `role: "system"` / `tool_addition`** | No (appends) | Yes (after breakpoint) | Mid-run policy shift, dynamic constraints, feature flags | Placing between `tool_use`/`tool_result` (400); lost if summarized unless re-stated (F17, F25, F26) |
| **Tool search (`defer_loading: true`)** | Yes (definitions, >85%) | Yes (`tool_reference` inline) | ≥10 tools, >10K tool tokens, multiple MCP servers | +1 search turn latency; 400 if `cache_control` placed on deferred tool (F28, F29) |
| **Programmatic tool calling (PTC)** | Yes (intermediate `tool_result`s) | Yes (container state separate) | Fan-out/loops over 10–50+ items, big raw payloads to filter | ~4m (270s) call timeout; no `strict: true` or MCP connector; +8% cost on 1–2 sequential calls (F30) |
| **Context editing (`clear_tool_uses` / `clear_thinking`)** | Yes (surgical pruning) | No when clearing occurs (`clear_thinking` with `keep: "all"` preserves) | Long loops with bulky stale `tool_result`s or old thinking | Frequent cache busting if `clear_at_least` is unset; losing needed early evidence (F12, F13) |
| **On-demand compaction (`compact-2026-09-04`)** | Yes (summarizes prefix) | Rebuilds once after swap | Controlled pauses, background compaction, keep-tail + preserved thinking | Lossy summary drops early constraints/images; `compaction_block_misplaced` if history isn't sliced cleanly (F16, F17) |
| **Threshold compaction (`compact_20260112`)** | Yes (auto-summarizes) | Rebuilds conversation cache (keep breakpoint on `system`) | Drop-in long-loop safety net when app won't manage compaction timing | Uses main model (expensive); summarizer may call tools (`content: null`) without explicit no-tool prompt (F18, F19) |
| **Memory tool (`memory_20250818`) + `CLAUDE.md`** | Yes (offloads to disk/DB) | Yes (read on demand as `tool_result`) | Multi-session tasks, durable constraints, progress checklists | Path traversal risk if `/memories` isn't sandboxed; Claude Code subdir `CLAUDE.md` is compacted away (F20, F21, F32) |

### What must survive summarization & detecting loss of constraints
1. **What must survive**: `[INFERENCE]` Architectural invariants, user-specified constraints/negative rules ("never modify prod DB"), agreed schemas/identifiers, open blockers, verified vs. unverified status, and exact file paths/artifact locations. By default, raw `role: "system"` mid-conversation instructions, per-message effort overrides, images/PDFs, and Claude Code path-scoped rules / subdirectory `CLAUDE.md` files do **not** survive summarization (F17, F32).
2. **Structural preservation mechanisms**:
   - Store durable constraints in **project-root `CLAUDE.md`**, **`/memories` files** (`memory_20250818`), or **JSON progress/feature checklists** (Claude is less likely to corrupt JSON than Markdown) rather than relying purely on conversational turns (F21, F32).
   - In Claude Code, use a **`SessionStart` hook matching `compact`** to deterministically re-inject critical constraints after compaction, or use `# Compact instructions` in `CLAUDE.md` (F32).
   - In the Messages API, use custom `instructions` tuned for **recall first, then precision** (F34), use **keep-tail compaction** to retain the newest turns verbatim, and re-append any active `role: "system"` constraint right after the next `user` turn post-compaction (F17).
3. **Detecting loss of constraints and compaction failures**:
   - **API-level checks**: Always inspect `stop_reason` on compaction responses (`max_tokens`, `tool_use`, `refusal`, `end_turn` yield empty `content`, meaning no summary was produced) and check for `compaction.content is None` in threshold compaction (F19). On `count_tokens`, check post-edit effective length before sending.
   - **Cache & thrashing telemetry**: `[INFERENCE]` Monitor `cache_read_input_tokens` vs. `cache_creation_input_tokens` per turn; unexpected spikes in `cache_creation_input_tokens` (without a planned compaction) indicate silent prefix invalidation. In Claude Code, if a single giant file immediately refills the window after compaction, Claude Code halts with a thrashing error instead of looping indefinitely.
   - **Behavioral drift checks**: `[INFERENCE]` Watch for agents re-exploring already-completed steps, violating early negative constraints, dropping output-format rules, or prematurely declaring a multi-feature task finished—all classic symptoms of lossy summarization or post-compaction amnesia.

## Worked example(s)

**Scenario**: A long-running support/code triage agent connects to 6 MCP servers (85 tools, ~62k tokens of schemas), runs 40+ tool turns, and must accept a mid-run compliance escalation ("redact all PII in explanations") without busting its prompt cache, while surviving context limits.

*Code status*: Illustrative Python using `anthropic` SDK v1.8+ patterns verified against current Messages API beta specs (`compact-2026-09-04`, `tool_search_tool_regex_20251119`, `memory_20250818`). Not executed in this workspace.

```python
import anthropic
client = anthropic.Anthropic()

TOOLS = [
    {"type": "tool_search_tool_regex_20251119", "name": "tool_search_tool_regex"},
    {"type": "memory_20250818", "name": "memory"},
    {"name": "get_ticket", "description": "Fetch ticket metadata.", "cache_control": {"type": "ephemeral"},
     "input_schema": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}},
    *[{"name": f"svc_tool_{i}", "description": f"Catalog tool {i}",
       "input_schema": {"type": "object", "properties": {}}, "defer_loading": True} for i in range(84)],
]
SYSTEM = [{"type": "text", "text": "Triage agent. Save invariants to /memories/findings.json.",
           "cache_control": {"type": "ephemeral"}}]  # Keeps system cached across compactions

def step_agent(history: list[dict], user_msg: dict, escalation_rule: str | None = None):
    history.append(user_msg)
    if escalation_rule:  # Cache-safe: append role="system" AFTER user turn; never edit SYSTEM
        history.append({"role": "system", "content": escalation_rule})
    resp = client.beta.messages.create(
        model="claude-opus-5-5", max_tokens=4096, betas=["compact-2026-09-04"],
        system=SYSTEM, tools=TOOLS, messages=history,
    )
    history.append({"role": "assistant", "content": resp.content})
    u = resp.usage
    occupied = u.input_tokens + (u.cache_creation_input_tokens or 0) + (u.cache_read_input_tokens or 0) + u.output_tokens
    if occupied > 180_000 and resp.stop_reason == "end_turn":
        cut = max(0, len(history) - 2)  # Keep-tail: preserve last user+assistant turn verbatim
        comp = client.beta.messages.create(
            model="claude-opus-5-5", max_tokens=4096, betas=["compact-2026-09-04"],
            system=SYSTEM, tools=TOOLS, messages=history[:cut],
            compaction={"type": "summarize",
                        "instructions": "Summarize verified facts, ticket IDs, and rules in <summary></summary>. Do not call tools."},
        )
        if comp.stop_reason == "compaction" and comp.content:
            history[:] = [{"role": "assistant", "content": comp.content}, *history[cut:]]
    return resp
```

*Token economics*: Deferring 84 tools removes ~60k tokens from the initial prefix (F28). On turn 2+, `SYSTEM` + 3 core tools read at $0.20/MTok (`0.05×` on Opus 5.5) instead of $4.00/MTok. Appending `role: "system"` after `new_user_msg` preserves 100% of that cache hit (F25). When `occupied > 180_000`, keep-tail compaction shrinks history while `SYSTEM` stays cached (F18), and `/memories/findings.json` preserves invariants across the cut (F21).

## Diagram spec

- **Type**: `flow`
- **Nodes & Edges**:
  1. `Request Prefix [tools (non-deferred) → system → messages]` --(matched byte-for-byte up to `cache_control`)--> `Prompt Cache Hit (0.025x–0.1x cost, still occupies window)`
  2. `Large Tool Catalog (>10 tools)` --(`defer_loading: true` + Tool Search)--> `Prefix stays small; tool_reference appended inline (cache preserved)`
  3. `Bulky Multi-Tool Loops` --(PTC `allowed_callers: code_execution`)--> `Intermediate tool_results stay in container (window & cache preserved)`
  4. `Mid-Run Instruction / Tool Change` --(Append `role: "system"` / `tool_addition` after `user` turn)--> `Prefix unchanged (cache preserved)`
  5. `Approaching Context Limit / Context Rot` --(`clear_tool_uses` OR `compact-2026-09-04` / `compact_20260112`)--> `Tokens evicted/summarized (window shrunk, conversation cache rebuilt; durable state read from /memories or CLAUDE.md)`
- **Caption**: Context-policy flow showing how deferred loading, programmatic tool calling, and appended `role: "system"` messages preserve the `tools → system → messages` cache prefix, whereas context editing and compaction trade a conversation-cache rebuild to reclaim context capacity and mitigate context rot.

## Exam lens

*(Editorial inference — pattern analysis, not real exam items.)*

1. **Cache reuse vs. context capacity trap**: A question describes an agent hitting context limits or suffering degraded recall ("context rot") and offers "enable prompt caching" as a distractor. Caching lowers cost and TTFT, not token occupancy (F1, F4); the correct fix is compaction, context editing, deferred tool loading, or PTC.
2. **Cache-safe mid-conversation steering**: An agent must inject a new compliance rule or add/remove a tool mid-session without causing a full prefix cache miss across 150K tokens of history. Editing top-level `system` or `tools` invalidates everything downstream (F22); appending a `role: "system"` message (or `tool_addition`/`tool_removal` with `inline-tools-2026-09-15`) after the latest `user` turn preserves the prefix cache (F25, F26).
3. **Selecting the right tool-bloat lever**: Distinguish **definition bloat** (80 MCP tools consuming 60k upfront → Tool Search with `defer_loading: true`) from **intermediate-result bloat** (a loop fetching 50 large records to compute one aggregate → Programmatic Tool Calling) from **historical-turn bloat** (40 turns of stale file reads → `clear_tool_uses_20250919` with `clear_at_least` or compaction) (F31).
4. **Surviving compaction & multi-session amnesia**: An agent loses an early architectural rule or file constraint after auto-compaction. Subdirectory `CLAUDE.md`, `paths:`-scoped rules, and mid-conversation `role: "system"` messages inside the summarized range do not survive compaction automatically (F17, F32); move durable invariants to project-root `CLAUDE.md`, `/memories` (`memory_20250818`), or `SessionStart` (`compact`) hooks, and verify `stop_reason == "compaction"`.

## Common mistakes

- **Placing `cache_control` on a `defer_loading: true` tool or on a block with a per-request timestamp**: `cache_control` on a deferred tool returns HTTP 400; placing a breakpoint on or after a volatile timestamp causes a 0% cache hit rate on every turn (F23).
- **Omitting `cache_control` at the end of `system` when using compaction**: Without a separate breakpoint on `system`, every compaction rebuilds and bills cache writes for the static system prompt too.
- **Misreading `usage.input_tokens` under caching or compaction**: With caching, `usage.input_tokens` only reflects tokens *after* the last breakpoint (F2); with compaction, top-level `usage` omits the summarization iteration—always sum `usage.iterations` (F18).
- **Combining `compaction` (`compact-2026-09-04`) and `context_management` on the same request**: Rejected by the API; also, never return a `tool_result` for `server_tool_use` (`srvtoolu_...`) from built-in tool search (F16).
- **Putting untrusted data in `role: "system"` or skipping path canonicalization in `/memories`**: Gives prompt-injected text operator authority (F27) or exposes host files via `/memories/../../secrets.env` (F20).
- **Relying on old-model token counts after upgrading to Claude 4.7+**: The newer tokenizer produces ~30% more tokens for the same text; always re-measure with `count_tokens` on the target model ID (F10).

## Self-check

1. **Q: You have 60 MCP tools, a 120K-token conversation with `cache_control` at the end of `system` and on the last assistant turn, and you must withdraw `delete_record` mid-session without invalidating the 120K cache. How?**
   **A:** Declare all 60 tools up front in `tools` (using `defer_loading: true` on non-core tools), enable `inline-tools-2026-09-15`, and append a `{"role": "system", "content": [{"type": "tool_removal", "tool": {"type": "tool_reference", "name": "delete_record"}}]}` message after the latest `user` turn. Never mutate `tools` or `system` mid-session (F25, F26).

2. **Q: Why can't `clear_tool_uses_20250919` without `clear_at_least` save money on a short-turn agent, and how does Haiku 5.5 interact with long cached prompts?**
   **A:** Clearing even one small tool result invalidates the conversation cache prefix and forces a 1.25× cache write (or uncached read) on the remaining history; `clear_at_least` prevents clearing unless enough tokens are reclaimed to offset the rebuild (F12). On Haiku 5.5, all input tokens—including `cache_read_input_tokens`—count toward the 100K-token prompt-length price jump (5× higher rates above 100K) (F8).

3. **Q: After on-demand compaction, your preserved-thinking request fails with a 400 prefix check error (`bound to a different conversation`) or an earlier rule vanishes. What are the two likely causes?**
   **A:** (a) You kept recent turns after the compaction block but mutated `system`, `tools`, or a kept message (or compacted on a model without preserved thinking); (b) the rule lived in a summarized `role: "system"` message (or path-scoped Claude Code rule), which stops applying after compaction unless re-stated or stored in `/memories` / root `CLAUDE.md` (F17, F32).

## Unresolved

- **Managed Agents compaction internals**: Official docs state Managed Agents compaction is always on and emits `agent.thread_context_compacted`, but the exact token trigger threshold and whether custom summarization instructions can be passed per agent are not specified in the fetched docs.
- **Exact `compact_20260112` default summarization prompt on every model**: The threshold compaction docs show one representative default prompt and note it "varies by model," without publishing the per-model string table.
