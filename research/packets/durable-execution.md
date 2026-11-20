# 1.2 Durable Execution and State Management

> Applying session persistence, checkpointing, resumability, and memory architecture patterns to long-running agents that must survive interruption, restart, and model version change.

## Scope map

| Sub-objective in official text | Covered in |
|---|---|
| `session persistence` | Core facts (F1–F7, F15), Exact API / config details, Practitioner reasoning |
| `checkpointing` | Core facts (F11–F14), Exact API / config details, Practitioner reasoning |
| `resumability` | Core facts (F3, F6, F8–F10, F16–F20, F32–F34), Practitioner reasoning, Worked examples, Diagram spec |
| `memory architecture patterns` | Core facts (F28–F31), Exact API / config details, Practitioner reasoning |
| `survive interruption, restart` | Core facts (F9, F16, F18–F20, F32–F34), Practitioner reasoning, Worked examples, Diagram spec |
| `survive ... model version change` | Core facts (F21–F27), Exact API / config details, Practitioner reasoning, Worked examples |

## Core facts

- **Agent SDK session transcripts are automatic, local-first conversation logs.** The SDK writes every prompt, tool call, tool result, and model response to disk as JSONL under `~/.claude/projects/<encoded-cwd>/*.jsonl` (or `$CLAUDE_CONFIG_DIR/projects/`), unless disabled via `persistSession: false` (TypeScript) or `CLAUDE_CODE_SKIP_PROMPT_HISTORY` (Python) (F1, F4, F5).
- **Sessions persist conversation state, not filesystem state.** Restoring a session brings back the message history, whereas reverting workspace file edits requires file checkpointing (F2).
- **Continue, resume, and fork serve distinct lifecycle needs.** `continue` picks the latest session in the working directory, `resume` targets a specific `session_id`, and `fork` copies an existing transcript into a new `session_id` while leaving the original untouched (F3).
- **External `SessionStore` enables multi-host durability.** Implementing `append` and `load` mirrors JSONL transcripts to an object store, database, or KV store; concurrent `append` calls must be serialized per session to prevent races on the summary sidecar (F6, F7).
- **Crashed in-flight tool calls are never auto-replayed on resume.** If a process dies while a tool is executing, resuming the session restores the transcript up to the crash and does not rerun the interrupted tool call (F9).
- **Raw JSONL session formats are internal and unstable across releases.** Scripts should use SDK session helpers (`list_sessions`, `get_session_messages`, `fork_session`) or `/export` rather than parsing `.jsonl` files directly (F10).
- **Claude Code and Agent SDK file checkpointing tracks tool-driven edits only.** Checkpoints are captured before each turn-starting user prompt (retaining up to 100 checkpoints per session for ~30 days by default); `rewind_files()` / `rewindFiles()` restores files on disk without rewinding the conversation, does not revert edits made solely by Bash or non-foreground subagents, and is not copied into forked sessions (F11, F12, F13, F14).
- **Claude Managed Agents stores state server-side and decouples brain, hands, and session log.** Sessions maintain conversation history, sandbox state, and outputs across `idle`, `running`, `rescheduling` (automatic transient retry), and `terminated` states; hosted Managed Agents is ineligible for ZDR and HIPAA except in self-hosted deployments (F15, F16, F19, F20).
- **Managed Agents SSE reconnection requires history-plus-tail deduplication.** Clients must open the event stream before listing historical event IDs and deduplicating live events to avoid missing events emitted during reconnect (F18).
- **Managed Agents pins model, system prompt, and skills per session.** Only `tools` and `mcp_servers` can be replaced mid-session (while `idle` with no open workflow runs) (F17).
- **Model deprecations give >= 60 days' notice on Anthropic-operated platforms, while partner platforms differ.** Retired models fail requests; resuming in Claude Code retains the saved model unless retired, excluded by `availableModels`, overridden by alias env vars, or running on deployment-ID cloud platforms (F21, F22).
- **Model changes invalidate prompt caches and interact asymmetrically with preserved thinking.** Each model has a separate KV cache, so switching models triggers an uncached full-history read (F23). On preserved-thinking models, switching models drops unreadable thinking blocks for that turn without error (and restores readability if switching back), but sending deprecated `thinking: {"type": "enabled"}` or mutating `system`/`tools`/prior messages causes a 400 error unless `prefix_mismatch_behavior: "drop_block"` is passed with `thinking-binding-controls-2026-08-01` (F24, F25, F26, F27).
- **Persistent memory architectures complement transcripts and compaction.** The client-side memory tool (`memory_20250818`, ZDR/HIPAA-eligible) pairs with compaction to retain critical state across summarizations (F28); Claude Code auto memory (`MEMORY.md` + topic files) is excluded from `cleanupPeriodDays` transcript deletion (F29); Managed Agents memory stores (`agent-memory-2026-07-22`) version every write immutably (F30); and structured JSON progress files resist accidental model corruption better than Markdown (F31).
- **Bounded retries and idempotency hints govern tool durability.** Anthropic SDKs retry transient HTTP errors twice by default (`max_retries`), excluding mid-stream SSE errors after HTTP 200 (F32); MCP `ToolAnnotations.idempotentHint` (default `false`) advertises retry safety as an untrusted hint (F33); and SRE best practice bounds per-request retries with randomized exponential backoff plus jitter (F34).

## Exact API / config details

### Claude Agent SDK (Python & TypeScript) & Claude Code CLI
- **Session options (`ClaudeAgentOptions` in Python / `Options` in TypeScript):**
  - `continue_conversation: bool` (Python) / `continue: boolean` (TS) — resume most recent session in `cwd` (F3).
  - `resume: str | None` (Python) / `resume?: string` (TS) — resume specific `session_id` captured from `ResultMessage.session_id` or `SystemMessage` (F3).
  - `fork_session: bool` (Python) / `forkSession?: boolean` (TS) — branch into a new `session_id` when paired with `resume`; or call synchronous `fork_session(session_id, directory=None, up_to_message_id=None, title=None)` (F3, F14).
  - `resume_session_at: str | None` / `resume_drops_turn: str | None` (Python SDK `>= 0.2.137`, CLI `>= v2.1.223`) — truncate resumed transcript at a specific message UUID (F8).
  - `persistSession: false` (TS only) or `env={"CLAUDE_CODE_SKIP_PROMPT_HISTORY": "1"}` (Python) — disable transcript disk writes (F5).
  - `session_store: SessionStore | None`, `session_store_flush: Literal["batched", "eager"] = "batched"`, `load_timeout_ms: int = 60_000` — external transcript mirroring via `SessionKey(project_key, session_id, subpath?)` (F6, F8).
- **Transcript storage & retention:**
  - Path: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` (override base via `CLAUDE_CONFIG_DIR`, override `<encoded-cwd>` via `CLAUDE_CODE_PROJECT_DIR_NAME` when `CLAUDE_CONFIG_DIR` is set) (F4).
  - Retention settings: `cleanupPeriodDays` in `settings.json` (default ~30 days for transcripts & checkpoints); `CLAUDE_CODE_TRANSCRIPT_LOCAL_GC` caps `-p`/SDK transcript growth; `--no-session-persistence` disables persistence for a single `claude -p` run (F11, F29).
- **File checkpointing & rewind:**
  - SDK options: `enable_file_checkpointing=True` + `extra_args={"replay-user-messages": None}` (Python), or `enableFileCheckpointing: true` + `extraArgs: { "replay-user-messages": null }` (TS) so turn-starting `UserMessage.uuid` values appear in the stream (F13).
  - Restore methods: `await client.rewind_files(checkpoint_id)` (Python) / `await response.rewindFiles(checkpointId)` (TS), or CLI `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=true claude -p --resume <session-id> --rewind-files <checkpoint-uuid>` (F13).
  - Limits: 100 most recent checkpoints retained per session in Claude Code; interactive `/rewind` (or `/undo`, double `Esc`) offers *Restore code and conversation*, *Restore conversation*, *Restore code*, *Summarize from here*, *Summarize up to here* (F11, F12).

### Claude Managed Agents (`betaHeader: managed-agents-2026-04-01`)
- **Endpoints & status enum (`GET /v1/sessions/{id}`):** `idle`, `running`, `rescheduling` (auto-retrying transient error), `terminated` (archived or unrecoverable error) (F16).
- **Session creation & updates:** `POST /v1/sessions` with `agent` (string ID or `{"type": "agent", "id": "...", "version": 1}` to pin version), `environment_id`, optional `initial_events` (max 50 `user.message` / `user.define_outcome` events), optional `budget`, optional `resources` (`type: "memory_store"`). Mid-session `POST /v1/sessions/{id}` updates only `agent.tools` and `agent.mcp_servers` (full replacement, only when `idle` with no open workflow run) (F17).
- **Memory Stores (`betaHeader: agent-memory-2026-07-22`) & Dreams (`dreaming-2026-04-21`):**
  - Endpoints: `POST /v1/memory_stores` (`memstore_...`), `POST /v1/memory_stores/{id}/memories`. Never send both `managed-agents-2026-04-01` and `agent-memory-2026-07-22` on memory store calls (returns HTTP `400`). Limits: `100 kB` (~25k tokens) per memory, `10,000` memories per store, `4,096` chars for attachment `instructions`; `access`: `"read_write"` (default) or `"read_only"` (F30).

### Messages API, Memory Tool, & Preserved Thinking Compatibility
- **Memory tool (`tools` entry):** `{"type": "memory_20250818", "name": "memory"}` (no beta header required; SDK helpers `BetaLocalFilesystemMemoryTool` / `BetaAbstractMemoryTool` in `anthropic.tools`) (F28).
- **Claude Code memory limits:** `CLAUDE.md` loaded up to `4 MiB` per file; `MEMORY.md` index loaded up to first `200` lines or `25 KB` (whichever comes first) (F29).
- **Model lifecycle & deprecation example:** States `Active` -> `Legacy` -> `Deprecated` -> `Retired` (>= 60 days' notice on first-party API). `claude-sonnet-4-5-20250929` (`claude-sonnet-4-5`) deprecated `2026-09-30`, retires `2026-11-30`, recommended replacement `claude-sonnet-5-5` (F21).
- **Preserved thinking & prefix binding:**
  - Models with preserved thinking (`claude-fable-5-2`, `claude-mythos-5-2`, `claude-fable-5-1`, `claude-mythos-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`) reject `thinking: {"type": "enabled", "budget_tokens": ...}` with HTTP `400` `invalid_request_error`; use `thinking: {"type": "adaptive"}` (or omit `thinking`) (F25).
  - Prefix mismatch error: HTTP `400` `invalid_request_error` containing `Invalid signature in thinking block. The block is bound to a different conversation.` (F26).
  - Recovery header & field: `anthropic-beta: thinking-binding-controls-2026-08-01` with `thinking: {"type": "adaptive", "block_binding": {"prefix_mismatch_behavior": "drop_block"}}` (or `"error"` in CI/tests), inspecting `response.input_transformations` for `thinking_mismatch_allowed` / dropped blocks (F26).
- **SDK retries & HTTP errors:** `max_retries` (Python) / `maxRetries` (TS) defaults to `2` with exponential backoff honoring `retry-after` on connection errors, `429` (`rate_limit_error`), `500` (`api_error`), `504` (`timeout_error`), and `529` (`overloaded_error`); mid-stream SSE errors after `200` do not trigger HTTP retries (F32).

## Practitioner reasoning

- **[INFERENCE] Separate session state from business state.** Session state (conversation transcript, thinking blocks, tool call/result pairs, sandbox files) is ephemeral orchestration scaffolding owned by the agent harness (F1, F2, F10). Business state (payment ledger entries, ticket statuses, order records, workflow checkpoints) belongs in an application-owned transactional database (e.g., Postgres/SQLite) with explicit schemas. Storing business state only inside a JSONL transcript or `MEMORY.md` makes queries fragile, fails across schema changes (F10), and conflates probabilistic LLM context with deterministic system-of-record state.
- **[INFERENCE] Persist step results before acting (write-ahead step log) and handle uncertain completion.** Because crashed tool calls are never replayed on Agent SDK resume (F9) and timeouts leave the caller unable to distinguish "never ran" from "ran before disconnect," side-effecting tools should:
  1. Derive a deterministic **idempotency key** from `(workflow_run_id, step_name, canonical_args_hash)` (never a fresh `uuid4()` per retry).
  2. Check a **durable step log** before calling the external API: on `SUCCEEDED`, return the cached `tool_result` (deduplication); on `IN_FLIGHT` (**uncertain completion**), query a reconciliation endpoint by idempotency key before reusing the result, retrying (only if `idempotentHint: true`, F33), or returning `uncertain_completion` to Claude.
  3. Persist the external result *before* appending `tool_result` to the transcript.
- **[INFERENCE] Use compensating actions for non-reversible side effects.** File checkpointing (`rewind_files()`) reverts tracked tool edits on local disk (F13), not external HTTP `POST`s, emails, or Bash DB writes (F12). Defer irreversible calls behind approval gates or pair each committed external step with an explicit compensating action (e.g., `refund_payment`, `void_invoice`) in the saga log.
- **[INFERENCE] Bound retries with backoff + jitter and classify failures.** While the Anthropic SDK retries transient HTTP errors twice by default (F32), tool loops need a per-step `max_attempts` budget with randomized exponential backoff + jitter (F34). Never retry deterministic `400` `invalid_request_error`s or non-idempotent `IN_FLIGHT` calls without reconciliation.
- **Surviving a model version change mid-session (e.g., `claude-sonnet-4-5-20250929` retiring Nov 30, 2026 -> `claude-sonnet-5-5`, F21):**
  1. Replace legacy `thinking: {"type": "enabled", "budget_tokens": N}` with `{"type": "adaptive"}` to avoid HTTP `400` (F25).
  2. Keep passing the full assistant history; the API drops unreadable thinking blocks from prior models without error (F24), though prompt caches start cold (F23).
  3. Keep active sessions on their last successful `system` and `tools` snapshot, appending changes as trailing `role: "system"` / `user` messages (F27); if an upstream prefix edit already occurred, recover that conversation with `thinking-binding-controls-2026-08-01` + `prefix_mismatch_behavior: "drop_block"` (F26).
  4. In Managed Agents, `model` and `system` are immutable per session (F17): persist domain state in a **Memory Store** (`memstore_...`, F30) or external DB and start a new session on the updated agent version.
- **[INFERENCE] State schema / version migration across restarts.** Because Agent SDK JSONL formats are internal and unstable (F10), store resumable business state as versioned JSON records (`{"schema_version": 2, ...}`) in your own DB or structured JSON files (preferred over Markdown, F31), and run pure forward-migration functions (`migrate_v1_to_v2`) on load.

## Worked example(s)

### Python sketch: Idempotent tool executor with a durable SQLite step log

*Status: Self-contained Python 3.11+ runnable sketch using stdlib `sqlite3` + `hashlib` (demonstrating the wrapper you plug into an `anthropic` Messages API loop or Claude Agent SDK custom MCP tool handler).*

```python
from __future__ import annotations

import hashlib
import json
import random
import sqlite3
import time
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class StepOutcome:
    status: str  # "SUCCEEDED" | "FAILED_TERMINAL" | "UNCERTAIN"
    result_json: str


class DurableToolExecutor:
    """Write-ahead step log preventing duplicate side effects across crashes/retries."""

    def __init__(self, db_path: str) -> None:
        self.conn = sqlite3.connect(db_path, isolation_level=None)
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tool_steps (
                idempotency_key TEXT PRIMARY KEY,
                tool_name TEXT NOT NULL,
                args_hash TEXT NOT NULL,
                status TEXT NOT NULL,      -- IN_FLIGHT | SUCCEEDED | FAILED_TERMINAL
                attempts INTEGER NOT NULL DEFAULT 0,
                result_json TEXT,
                updated_at REAL NOT NULL
            )
            """
        )

    @staticmethod
    def make_key(workflow_id: str, step_id: str, tool_name: str, args: dict[str, Any]) -> tuple[str, str]:
        canonical = json.dumps(args, sort_keys=True, separators=(",", ":"))
        args_hash = hashlib.sha256(canonical.encode()).hexdigest()
        raw = f"{workflow_id}:{step_id}:{tool_name}:{args_hash}"
        return hashlib.sha256(raw.encode()).hexdigest(), args_hash

    def execute(
        self,
        *,
        workflow_id: str,
        step_id: str,
        tool_name: str,
        args: dict[str, Any],
        fn: Callable[[dict[str, Any], str], dict[str, Any]],
        reconcile_fn: Callable[[str], dict[str, Any] | None] | None = None,
        is_idempotent: bool = False,
        max_attempts: int = 3,
    ) -> StepOutcome:
        key, args_hash = self.make_key(workflow_id, step_id, tool_name, args)

        row = self.conn.execute(
            "SELECT status, attempts, result_json FROM tool_steps WHERE idempotency_key = ?",
            (key,),
        ).fetchone()

        if row is not None:
            status, attempts, result_json = row
            if status == "SUCCEEDED" and result_json is not None:
                return StepOutcome("SUCCEEDED", result_json)  # Deduplicated replay
            if status == "FAILED_TERMINAL" and result_json is not None:
                return StepOutcome("FAILED_TERMINAL", result_json)
            if status == "IN_FLIGHT":
                # Previous worker crashed mid-call: uncertain completion
                if reconcile_fn is not None:
                    reconciled = reconcile_fn(key)
                    if reconciled is not None:
                        payload = json.dumps(reconciled)
                        self._mark(key, "SUCCEEDED", attempts, payload)
                        return StepOutcome("SUCCEEDED", payload)
                if not is_idempotent:
                    return StepOutcome(
                        "UNCERTAIN",
                        json.dumps({"error": "uncertain_completion", "idempotency_key": key}),
                    )
        else:
            self.conn.execute(
                """
                INSERT INTO tool_steps (idempotency_key, tool_name, args_hash, status, attempts, updated_at)
                VALUES (?, ?, ?, 'IN_FLIGHT', 0, ?)
                """,
                (key, tool_name, args_hash, time.time()),
            )

        # Bounded retries with randomized exponential backoff + jitter
        for attempt in range(1, max_attempts + 1):
            self.conn.execute(
                "UPDATE tool_steps SET attempts = ?, status = 'IN_FLIGHT', updated_at = ? WHERE idempotency_key = ?",
                (attempt, time.time(), key),
            )
            try:
                result = fn(args, key)  # Pass idempotency_key downstream (e.g., Stripe Idempotency-Key)
                payload = json.dumps(result)
                self._mark(key, "SUCCEEDED", attempt, payload)
                return StepOutcome("SUCCEEDED", payload)
            except TimeoutError:
                if not is_idempotent or attempt == max_attempts:
                    return StepOutcome(
                        "UNCERTAIN",
                        json.dumps({"error": "timeout_uncertain_completion", "idempotency_key": key}),
                    )
            except TransientToolError:
                if attempt == max_attempts:
                    break
            except TerminalToolError as exc:
                payload = json.dumps({"error": str(exc)})
                self._mark(key, "FAILED_TERMINAL", attempt, payload)
                return StepOutcome("FAILED_TERMINAL", payload)

            delay = (0.5 * (2 ** (attempt - 1))) + random.uniform(0, 0.25)
            time.sleep(delay)

        payload = json.dumps({"error": "retry_budget_exhausted", "idempotency_key": key})
        self._mark(key, "FAILED_TERMINAL", max_attempts, payload)
        return StepOutcome("FAILED_TERMINAL", payload)

    def _mark(self, key: str, status: str, attempts: int, result_json: str) -> None:
        self.conn.execute(
            "UPDATE tool_steps SET status = ?, attempts = ?, result_json = ?, updated_at = ? WHERE idempotency_key = ?",
            (status, attempts, result_json, time.time(), key),
        )


class TransientToolError(Exception):
    pass


class TerminalToolError(Exception):
    pass
```

### Python sketch: Recovering a resumed session across a model version change (`anthropic` Python SDK pattern)

*Status: Pseudocode / SDK pattern verified against `preserved-thinking/fix-bound-to-a-different-conversation` and `thinking` docs (`anthropic` Messages API).*

```python
import anthropic

client = anthropic.Anthropic(max_retries=2)

def call_resumed_session(saved_state: dict, target_model: str = "claude-sonnet-5-5"):
    # Normalize deprecated thinking config when migrating from 4.5 -> 5.5 (F25)
    thinking_cfg: dict = {"type": "adaptive"}
    extra_betas: list[str] = []

    if saved_state.get("prefix_mismatch_recovery"):
        thinking_cfg["block_binding"] = {"prefix_mismatch_behavior": "drop_block"}
        extra_betas.append("thinking-binding-controls-2026-08-01")

    try:
        return client.beta.messages.create(
            model=target_model,
            max_tokens=16000,
            system=saved_state["system"],   # Frozen from last successful turn (F27)
            tools=saved_state["tools"],     # Frozen from last successful turn (F27)
            messages=saved_state["messages"],
            thinking=thinking_cfg,
            betas=extra_betas,
        )
    except anthropic.BadRequestError as err:
        # Handle prefix check 400 ("The block is bound to a different conversation") (F26)
        if "bound to a different conversation" in str(err):
            saved_state["prefix_mismatch_recovery"] = True  # Persist with conversation
            thinking_cfg["block_binding"] = {"prefix_mismatch_behavior": "drop_block"}
            return client.beta.messages.create(
                model=target_model,
                max_tokens=16000,
                system=saved_state["system"],
                tools=saved_state["tools"],
                messages=saved_state["messages"],
                thinking=thinking_cfg,
                betas=["thinking-binding-controls-2026-08-01"],
            )
        raise
```

## Diagram spec

- **Type:** `sequence`
- **Actors / Nodes:** `AgentRunner`, `SessionStore` (transcript JSONL / DB), `StepLog` (transactional DB), `PaymentGateway`
- **Edges / Messages (step-by-step):**
  1. `AgentRunner -> SessionStore`: `append(assistant_turn with tool_use: charge_card)`
  2. `AgentRunner -> StepLog`: `INSERT (idempotency_key=k1, status=IN_FLIGHT)`
  3. `AgentRunner -> PaymentGateway`: `POST /charges (Idempotency-Key: k1, amount=$49.00)`
  4. `PaymentGateway -->> AgentRunner`: `200 OK {charge_id: "ch_99", status: "captured"}`
  5. `AgentRunner -> StepLog`: `UPDATE status=SUCCEEDED, result_json={charge_id: "ch_99"}` (persisted **before** advancing conversation)
  6. `AgentRunner --x AgentRunner`: **CRASH** before writing `tool_result` to `SessionStore` or calling Claude
  7. `AgentRunner` restarts and calls `SessionStore -> AgentRunner`: `load(session_id)` (finds dangling `tool_use` for `k1`; interrupted tool calls are not auto-rerun, F9)
  8. `AgentRunner -> StepLog`: `SELECT status, result_json WHERE idempotency_key=k1`
  9. `StepLog -->> AgentRunner`: `status=SUCCEEDED, result_json={charge_id: "ch_99"}` (no second call to `PaymentGateway`)
  10. `AgentRunner -> SessionStore`: `append(user_turn with tool_result: {charge_id: "ch_99"})` and resumes model loop
- **Caption:** Write-ahead persistence of a payment tool result to a durable step log prevents duplicate charges when the agent crashes before appending the `tool_result` to its session transcript and resumes on a fresh worker.

## Exam lens

- *(Editorial inference)* **Pattern 1 — Separating transcript, file, and external durability:** On crash recovery after local edits and external API calls, `resume` restores only the transcript (F2), `rewind_files()` reverts only tool-edited local files (not Bash or external writes, F12, F13), and external side effects require a durable step log with idempotency keys rather than blind re-execution (F9).
- *(Editorial inference)* **Pattern 2 — Surviving mid-session model deprecation:** When migrating active workflows from a retiring model (e.g., `claude-sonnet-4-5-20250929` to `claude-sonnet-5-5`, F21) alongside updated prompts or tools, keep running sessions on their last successful `system`/`tools` (or append updates at the end), switch `thinking.type` from `"enabled"` to `"adaptive"`, and apply `prefix_mismatch_behavior: "drop_block"` only for targeted `400` prefix recovery—accepting the cold cache on the new model (F23, F25, F26, F27).
- *(Editorial inference)* **Pattern 3 — Hosting and memory boundaries under ZDR/HIPAA:** Hosted Managed Agents sessions and Memory Stores are ineligible for ZDR/HIPAA; compliant workloads require self-hosted Managed Agents or the Messages API with client-side `memory_20250818` backed by compliant storage (F15, F28).
- *(Editorial inference)* **Pattern 4 — Ephemeral multi-host Agent SDK workers:** Serverless or CI workers without shared disk must attach a `SessionStore` (serializing sidecar writes, F6, F7) or externalize workflow state into versioned JSON/DB records (F31) instead of relying on local `--continue`.

## Common mistakes

- **Assuming `resume` replays crashed tools—or blindly rerunning them.** Resuming skips interrupted tools (F9); blindly rerunning non-idempotent calls causes duplicate charges or writes.
- **Expecting `rewind_files()` to revert Bash side effects, subagent edits, or messages.** File checkpointing reverts only tracked main-agent `Write`/`Edit`/`NotebookEdit` files, leaves conversation intact, and is dropped on `fork_session()` (F12, F13, F14).
- **Mutating `system` or `tools` on resumed preserved-thinking sessions, or combining conflicting Managed Agents beta headers.** Prefix edits trigger `400` errors (F26, F27), and sending both `managed-agents-2026-04-01` and `agent-memory-2026-07-22` to `/v1/memory_stores` returns `400` (F30).
- **Leaving `thinking: {"type": "enabled"}` on Claude 5/5.5 migrations.** Preserved-thinking models reject `"enabled"` with `400` (F25).
- **Enabling `"drop_block"` globally or skipping `SessionStore` in ephemeral containers.** Global `drop_block` masks prefix bugs while burning tokens and invalidating caches (F26); local `~/.claude/projects/` is lost on container restart (F4, F6).

## Self-check

1. **Q:** An Agent SDK workflow executes a non-idempotent `create_wire_transfer` tool, persists the receipt to SQLite, and crashes before writing the `tool_result` to the transcript. On `resume`, what happens?
   **A:** Resuming does not rerun the crashed tool call (F9). Because the step log holds `SUCCEEDED`, the harness replays the cached receipt into `tool_result` without calling the wire API again; an `IN_FLIGHT` row would require querying a reconciliation endpoint before acting.
2. **Q:** You migrate an active session from `claude-sonnet-4-5-20250929` (retiring Nov 30, 2026) to `claude-sonnet-5-5` while editing `system`. What two `400` errors arise and how do you avoid both?
   **A:** `claude-sonnet-5-5` rejects `thinking: {"type": "enabled"}` (`400`)—switch to `"adaptive"` (F25)—and mutating `system` breaks the preserved-thinking prefix check (`bound to a different conversation`)—keep the session's original `system` and append changes as a trailing message (or recover with `thinking-binding-controls-2026-08-01` + `drop_block`) (F26, F27).
3. **Q:** Under a strict ZDR mandate, a team configures Managed Agents with a Memory Store and sends both `managed-agents-2026-04-01` and `agent-memory-2026-07-22` to `POST /v1/memory_stores`. What fails?
   **A:** Sending both beta headers to a memory store endpoint returns `400` (use only `agent-memory-2026-07-22`) (F30), and hosted Managed Agents is ineligible for ZDR—use self-hosted Managed Agents or the Messages API with client-side `memory_20250818` (F15, F28).

## Unresolved

- **Built-in SDK idempotency keys & saga primitives:** Neither the Claude Agent SDK nor Claude Managed Agents documents built-in step-level idempotency keys, write-ahead tool-result journals, or compensating-action orchestration for arbitrary user/MCP tools; durable execution semantics for external side effects must be implemented by the developer's tool layer and workflow state store.
- **State schema migration tooling:** Anthropic docs warn that local `.jsonl` session schemas are internal and subject to breaking changes between Claude Code releases (F10), and provide no official schema-migration tool for transcripts; versioning and migrating application/business state schemas remains an application-level responsibility.
- **Managed Agents mid-session model migration:** Because `Session operations` specifies that only `tools` and `mcp_servers` can change after session creation (F17), there is no documented in-place API to change a running Managed Agents session's model; migrating a Managed Agents workload to a new model version requires creating a new session (optionally sharing a `memory_store`).
