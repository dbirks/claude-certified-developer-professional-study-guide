# 1.1 Multi-Agent Orchestration

> Evaluating orchestration patterns for production multi-agent designs and inter-agent failures, including supervisor/worker hierarchies, parallel subagent dispatch, delegation and context-isolation boundaries, inter-agent communication, and human-in-the-loop and approval flows.

## Scope map

| Sub-objective in official text | Packet section(s) |
|---|---|
| Evaluating orchestration patterns for production multi-agent designs | Core facts, Practitioner reasoning, Worked example(s), Exam lens |
| Inter-agent failures (and containment/cancellation) | Core facts, Exact API / config details, Practitioner reasoning (failure-mode table), Common mistakes |
| Supervisor/worker hierarchies | Core facts, Exact API / config details, Practitioner reasoning, Worked example(s) |
| Parallel subagent dispatch (and critical-path latency) | Core facts, Exact API / config details, Practitioner reasoning, Worked example(s) |
| Delegation and context-isolation boundaries | Core facts, Exact API / config details, Practitioner reasoning, Diagram spec, Common mistakes |
| Inter-agent communication (and structured handoffs) | Core facts, Exact API / config details, Practitioner reasoning, Diagram spec |
| Human-in-the-loop and approval flows | Core facts, Exact API / config details, Worked example(s), Diagram spec, Exam lens, Common mistakes |

## Core facts

- **Workflows vs. agents:** Workflows orchestrate LLMs and tools via predefined code paths; agents let LLMs dynamically direct their own processes and tool usage (F1). Anthropic recommends starting with the simplest pattern—often a single augmented LLM—and adding multi-agent complexity only when evidence justifies the latency and token cost (F1, F7, F13).
- **Five foundational patterns (*Building effective AI agents*):**
  - *Prompt chaining:* sequential LLM steps with optional programmatic gates, trading latency for accuracy on fixed subtasks (F2).
  - *Routing:* classifies inputs to specialized downstream prompts, tools, or models (e.g., Haiku vs. Sonnet) (F2).
  - *Parallelization:* *sectioning* (independent subtasks in parallel) or *voting* (multiple independent runs for confidence) (F3).
  - *Orchestrator-workers:* a central LLM dynamically determines subtasks from the input (unlike static sectioning), delegates to workers, and synthesizes results (F4).
  - *Evaluator-optimizer:* a generator and evaluator iterate in a loop when clear criteria exist and refinement adds measurable value (F5).
- **Multi-agent research system benchmarks & token economics:** On Anthropic's internal research eval, an Opus 4 lead with Sonnet 4 subagents outperformed single-agent Opus 4 by 90.2% on breadth-first queries; token usage alone explained 80% of BrowseComp variance (95% with tool calls and model choice) (F6). However, single agents use ~4x chat tokens and multi-agent systems use ~15x chat tokens, requiring high-value tasks with heavy parallelization or context exceeding one window (F7).
- **Delegation specs & effort scaling:** Lead prompts must embed effort-scaling rules (1 agent / 3–10 calls for lookups; 2–4 subagents / 10–15 calls for comparisons; >10 subagents for complex research) and explicit delegation specs (objective, output format, tool/source guidance, task boundaries) to prevent duplicate work (F8).
- **Two-tier parallelism & synchronous bottlenecks:** Parallelizing 3–5 subagents alongside 3+ parallel tool calls inside subagents cut research time by up to 90% (F9). Synchronous waiting blocks on the slowest subagent and prevents mid-flight steering; asynchronous execution increases concurrency at the cost of state consistency and error-propagation complexity (F11).
- **Stateful recovery & rainbow deployments:** Because agents are stateful and errors compound, production multi-agent systems require checkpoint/resume recovery and rainbow deployments that gradually shift traffic from old to new versions without disrupting active runs (F10).
- **Context-centric vs. problem-centric decomposition:** Splitting tightly coupled work by SDLC role (`planner -> coder -> tester -> reviewer`) causes handoff loss ("telephone game") and excessive coordination spend (F13). Splitting by context boundaries—independent search facets, clean API contracts, or black-box verification—isolates noise without losing coherence (F13).
- **Verification subagents & "early victory":** Verification subagents excel at black-box validation with minimal prior context, but suffer from the "early victory problem" (passing after 1–2 checks) unless explicitly instructed to run full suites, edge cases, and negative tests (F14).
- **Artifact-store bypass:** To prevent "telephone game" degradation and coordinator token bloat, subagents should write large structured outputs to a filesystem or artifact store and pass lightweight references back to the lead, which should persist plans to memory before context truncation (F12).
- **SDK subagent isolation & dispatch:** Non-fork SDK subagents start with a fresh isolated context (system prompt, `Agent` tool prompt string, `CLAUDE.md` unless `omitClaudeMd` is set, scoped tools) and return only their final message (F15). Concurrent subagents complete in the time of the slowest one rather than the sum (F16).
- **Claude Code vs. Agent Teams vs. Dynamic Workflows:**
  - *Subagents* are hub-and-spoke within one session; Claude Code scans subagent final reports for control-tag (`<system-reminder>`) or turn-marker (`Human:`/`Assistant:`) imitations before the parent reads them (F28), and surfaces partial outputs/API errors or fallback model switches cleanly (F29).
  - *Agent Teams* (experimental, interactive only) spawn peer sessions with `SendMessage` mailboxes and a file-locked shared task list, gated by `TeammateIdle` and `TaskCompleted` hooks (F30).
  - *Dynamic Workflows* (`Workflow` tool / Managed Agents `workflows`) move loops, branching, and intermediate results into an executed script outside the coordinator's context window (F31, F34).
- **Managed Agents multi-agent model:** `multiagent_20261001` unifies predefined/inline subagents, dynamic workflows, and an `advisor` model inside one session sharing a sandbox and `vault_ids` while isolating each agent in its own session thread (F32, F33).
- **Six-step HITL permission order:** The Agent SDK evaluates tool calls in fixed order: Hooks → Deny rules → Ask rules → Permission mode → Allow rules → `canUseTool` callback (F23). Tools auto-approved before step 6 skip `canUseTool`, so mandatory checks on auto-approved tools must run in `PreToolUse` hooks (F23) with `onFailure: "block"` (F26).

## Exact API / config details

### Claude Agent SDK (`claude_agent_sdk` / `@anthropic-ai/claude-agent-sdk`)

- **Invocation & tracing:** Subagents run via the `Agent` tool (`tool_use` `name == "Agent"`, or `"Task"` on CLI `< v2.1.63`) (F15). Subagent stream messages carry `parent_tool_use_id` (and `agent_id` in TS v0.3.292+) (F15). By default, background subagents return `status: "async_launched"`; blocking calls return `status: "completed"` (F16).
- **`AgentDefinition` fields:**
  - Required: `description` (`str`), `prompt` (`str`) (F15, F19).
  - Optional (Python & TS): `tools` (allowlist; omit to inherit subagent pool), `disallowedTools` (denylist applied before `tools`; accepts `mcp__server`, `mcp__server__*`, `mcp__*`), `model` (`'opus' | 'sonnet' | 'haiku' | 'fable' | 'inherit'` or full ID), `skills` (preloads up to 32 skills), `memory` (`'user' | 'project' | 'local'`), `mcpServers`, `initialPrompt` (ignored for subagents), `maxTurns` (marks output partial at limit on Claude Code v2.1.246+), `background` (`bool`), `effort` (`'low' | 'medium' | 'high' | 'xhigh' | 'max' | int`), `permissionMode` (F15, F19, F24).
  - TS-only fields: `autoCompactWindow` (`>= 100000`, v0.3.296+), `omitClaudeMd` (`bool`, v0.3.271+) (F15).
  - **Python casing rule:** `AgentDefinition` uses camelCase (`disallowedTools`, `permissionMode`, `maxTurns`) matching the wire format; `ClaudeAgentOptions` uses snake_case (`disallowed_tools`, `permission_mode`, `max_budget_usd`, `output_format`). Passing snake_case to `AgentDefinition` raises `TypeError` (F19).
- **Built-in removal & fork denial:** `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` disables `general-purpose` fallback (calls without `subagent_type` fail with `subagent_type is required`) (F17). `disallowed_tools=["Agent(fork)"]` blocks forks while keeping custom subagents (F17).
- **Depth, concurrency, and budget caps (TS v0.3.219+ / Python v0.2.127+):**
  - `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (via `env`): default `3`; `1` disables nesting (F18).
  - `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (via `env`): default `20`; excess spawns return `Concurrent subagent limit reached` (exempt under `ultracode`) (F18).
  - `max_budget_usd` / `maxBudgetUsd`: covers subagent spend; at cap, blocks spawns (`Budget limit reached`), stops background subagents, and yields `ResultMessage.subtype == "error_max_budget_usd"` (F18). TS `env` replaces `process.env` (spread `...process.env`); Python `env` merges (F18).
- **Cancellation, parallel tools, & cost:** `ClaudeSDKClient.stop_task(task_id)` / `Query.stopTask(taskId)` stops a background subagent (`TaskNotificationMessage` status `"stopped"`) and prevents auto-resume via `SendMessage` (F19, F29). `interrupt()` aborts a turn (`error_during_execution`) while keeping the session open (F21). Read-only tools and custom tools with `readOnlyHint` run concurrently within a turn; mutating tools (`Edit`, `Write`, `Bash`) run sequentially (F20). Read `ResultMessage.model_usage` / `modelUsage` for whole-tree cost (F20).
- **Structured handoffs:** `output_format` / `outputFormat: {"type": "json_schema", "schema": ...}` validates JSON Schema draft-07 (`z.toJSONSchema(s, {target: "draft-7"})` or Pydantic `.model_json_schema()`), outputting `ResultMessage.structured_output` or `error_max_structured_output_retries` (F22).
- **Permissions, `canUseTool`, and hooks:**
  - Modes: `"default"`, `"dontAsk"`, `"acceptEdits"`, `"plan"`, `"auto"`, `"bypassPermissions"` (TS requires `allowDangerouslySkipPermissions: true`; blocked as root/sudo outside recognized sandboxes) (F23, F24).
  - Subagent inheritance: parent `plan`, `acceptEdits`, `auto`, or `bypassPermissions` overrides `AgentDefinition.permissionMode`. Under parent `default`/`dontAsk`, subagent uses its `permissionMode` except `bypassPermissions` is never applied (v2.1.267+) (F24).
  - `canUseTool`: returns `Allow` (`updatedInput`/`updated_input`, optional `updatedPermissions`) or `Deny` (`message`); handles `AskUserQuestion` (1–4 questions, 2–4 options; unavailable in `Agent`-spawned subagents) and pauses indefinitely (F25).
  - `PreToolUse` hook: returns `hookSpecificOutput.permissionDecision` in `{"allow", "deny", "ask", "defer"}` (precedence `deny > defer > ask > allow`), `updatedInput`, `additionalContext` (F26, F27). Use `onFailure: "block"` / `on_failure="block"` (TS v0.3.317+ / Python v0.2.177+) to fail closed (F26).
  - Deferred HITL (`-p` single-tool turn): `PreToolUse` returning `"defer"` ends the turn with `stop_reason: "tool_deferred"` and `deferred_tool_use: {id, name, input}` for later `--resume <session_id>` (F27).
  - `SubagentStart` / `SubagentStop`: receive `agent_id` and `agent_type` (F26).

### Claude Code Subagents, Agent Teams, and Dynamic Workflows

- **Subagent precedence:** Managed settings > `--agents` CLI JSON (or file path in `-p`) > `.claude/agents/` (closest to CWD) > `~/.claude/agents/` > Plugin `agents/` (plugin subagents ignore `hooks`, `mcpServers`, `permissionMode`) (F28).
- **Isolation & output scanning:** `isolation: worktree` isolates bash/file edits per git worktree; `autoCompactWindow` (>= `100000`) forces earlier compaction; `omitClaudeMd: true` skips user/project/local `CLAUDE.md` (F28). Output scanning (v2.1.210+) neutralizes `<system-reminder>` / `Human:` / `Assistant:` imitations with backslashes and prepends `[harness: ...]` on permission-config mentions (F28).
- **Agent Teams (experimental):** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (interactive only; ignored in `-p`/SDK) (F30). Stores state in `~/.claude/teams/{team-name}/config.json`, `~/.claude/tasks/{team-name}/` (file-locked), and `~/.claude/teams/{team-name}/inboxes/{agent-name}.json` (F30). Hooks `TeammateIdle`, `TaskCreated`, `TaskCompleted` block/continue on exit code `2` or `decision: "block"` (F30). Limitations: 1 team/session, no nested teams, no `/resume` for in-process teammates, no per-teammate spawn permission modes (F30).
- **Dynamic Workflows:** `Workflow` tool (TS SDK v0.3.149+ `allowedTools: ["Workflow"]` or CLI `/workflows`) executes a generated JS script holding loops and intermediate state outside context (F31).

### Claude Managed Agents (`anthropic-beta: managed-agents-2026-04-01`)

- **`multiagent` block (`/v1/agents`):** `{"type": "multiagent_20261001", "subagents": {...}, "workflows": {...}, "advisor": {...}}` (`subagents` and `workflows` default enabled with `inline_agents` enabled; `advisor` defaults disabled) (F32).
- **Hard limits (HTTP 400 on invalid config):** **1-level** delegation depth (referencing a `multiagent` agent fails with 400); **20** max unique agents in `subagents.predefined_agents` and `workflows.predefined_agents` (empty list + disabled `inline_agents` fails with 400); **25** active/idle child threads per session (archive via `POST /v1/sessions/{id}/threads/{thread_id}/archive`; advisor and workflow-run threads exempt) (F32, F33). Workflow runs allow **64** concurrent threads/run, **1,000** agents/run lifetime (`thread_limit_error`), **10** open runs/session (`max_workflow_runs_error`), **24h** default lifetime (`timeout_error`) (F34).
- **Auth, HITL, & cancellation:** MCP servers are **agent-scoped**; `vault_ids` are **session-scoped** (F32). Child `requires_action` / `agent.custom_tool_use` events cross-post to the primary stream with `session_thread_id` and are answered via `user.tool_confirmation` / `user.custom_tool_result` (F33). `user.interrupt` with `session_thread_id` stops one thread; omitting it stops all non-archived threads (not open workflow runs) (F33, F34). Session budget pauses all open runs (`budget_reached`) until raised/removed (F34).

## Practitioner reasoning

### Choosing an orchestration topology

- **Default to single-agent:** `[INFERENCE]` Because multi-agent systems consume 3–15x more tokens than chat/single-agent loops (F7, F13), stay single-agent with `ToolSearch` and compaction unless facing: (1) >1,000-token noisy subtasks, (2) independent parallel branches, or (3) strict tool/privilege boundaries (F13, F15).
- **Subagents vs. Agent Teams vs. Dynamic Workflows:** Use **Subagents** for 2–10 focused hub-and-spoke delegations; **Agent Teams** only in interactive sessions needing peer critique or competing hypotheses; **Dynamic Workflows** when fanning out across dozens to hundreds of items so loop variables stay in code rather than coordinator context (F30, F31, F34).
- **Decompose by context, not role:** `[INFERENCE]` Keep tightly coupled planning, coding, and unit testing in one agent per component; isolate only independent facets or black-box verifiers (F13, F14).

### When parallelism reduces critical-path latency (and when it doesn't)

- **Critical-path math:** For $N$ independent subtasks, sequential execution takes $\sum_{i=1}^N T_i$, whereas parallel dispatch takes $\max_{i=1}^N T_i + T_{\text{coord}}$ (F16). Two-tier parallelism (3–5 subagents × 3+ parallel tools) reduced research wall-clock time by up to 90% (F9).
- **When parallelism fails to speed up execution:** `[INFERENCE]`
  1. *Synchronous straggler barriers:* Waiting on a whole wave stalls on the slowest worker or retry (F11).
  2. *Mutating tool serialization:* `Edit`, `Write`, `Bash`, and custom tools without `readOnlyHint` run sequentially per turn (F20); parallel writers without `isolation: worktree` collide or overwrite edits (F28, F30).
  3. *Shared rate-limit saturation:* Workers share org RPM/TPM quotas (F34); unbounded concurrency triggers `429` backoffs that make 20 parallel workers slower than bounded waves (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=4..5`) (F18, F34).
  4. *Cold-start cache penalty:* Fresh subagents rebuild prompt context without parent cache; for small shared-context subtasks, `subagent_type: "fork"` reuses the parent prompt cache (F28).

### Orchestration failure-mode table

| Failure mode | Root cause / mechanism | Detection signal | Containment & recovery |
|---|---|---|---|
| **Runaway fan-out / recursion** | Orchestrator over-spawns subagents or recurses deeply (F8, F18) | Rapid `modelUsage` cost spike; `Concurrent subagent limit reached` (F18, F20) | Cap `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, and `max_budget_usd` (`error_max_budget_usd`) (F18); add effort-scaling prompt rules (F8). |
| **Handoff "telephone game"** | Role-split pipelines re-summarize shared context; large outputs pass through coordinator (F12, F13) | Downstream requirement drift; bloated coordinator context (F12, F13) | Group by context boundary (F13); write large outputs to artifact store and return refs (F12); enforce `output_format` schemas (F22). |
| **Report-borne prompt injection** | Subagent ingests untrusted data and emits instruction-shaped text to parent (F28) | `[harness: subagent output matched instruction-shaped pattern(s): ...]` marker (F28) | Built-in output scanning (F28) + least-privilege `tools`/`disallowedTools` (F17), `PreToolUse` hooks (F23), and rejecting relayed agent approvals (F30). |
| **Verification "early victory"** | Verifier passes after 1–2 smoke tests without full suite (F14) | Verifier reports pass despite broken edge cases (F14) | Require full-suite + negative tests in verifier `prompt` (F14); run deterministic test check in `TaskCompleted`/`SubagentStop` hook (exit `2` blocks) (F30). |
| **Silent `canUseTool` bypass** | Policy placed in `canUseTool`, but tool auto-approved in steps 1–5 (F23) | Node `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` warning; unprompted execution (F23) | Move mandatory guards to `PreToolUse` hooks with `on_failure="block"` or `disallowed_tools` (F23, F26). |
| **HITL process hang / timeout** | `canUseTool` blocks indefinitely on slow human approval in ephemeral worker (F25, F27) | Hanging serverless/CI runner `[INFERENCE]` | Return `PreToolUse` `"defer"` in `-p` single-tool turns (`stop_reason: "tool_deferred"`), then `--resume` (F27); in Managed Agents, answer `requires_action` asynchronously (F33). |
| **Partial / silent worker failure** | API error, rate limit, or `maxTurns` cuts off worker; Managed Agents workflow catches error (F15, F29, F34) | Foreground partial / `Agent terminated early...`; background notice; `workflow_run.status_ended: completed` despite failed thread (F29, F34) | Inspect per-thread events and `ResultMessage.subtype` (F20, F34); configure fallback model chains (F29); resume via `agentId` + `session_id` (F15) or retry idempotent tools (F34). |
| **Shared-workspace edit collision** | Parallel agents mutate the same files concurrently (F28, F30) | Overwritten edits / git conflicts `[INFERENCE]` | Enable `isolation: worktree` (F28) or partition file ownership across teammates (F30); omit `readOnlyHint` on mutating custom tools (F20). |

## Worked example(s)

### 1. Latency vs. token trade-off math `[INFERENCE]`

Auditing 12 independent services ($45\text{s}$ and $30\text{k}$ tokens each; coordinator planning/synthesis $15\text{s}$ and $24\text{k}$ tokens):
- **Single-agent sequential:** $\approx 12 \times 45\text{s} = 540\text{s}$ ($360\text{k}$ accumulated tokens, risking compaction).
- **Bounded parallel (`MAX_CONCURRENT_SUBAGENTS=4`):** 3 waves of 4 workers $\rightarrow$ critical path $\approx 15\text{s} + 3 \times 45\text{s} = 150\text{s}$ (**3.6x speedup**); total spend $\approx 384\text{k}$ tokens across the tree (repeated `CLAUDE.md` overhead avoidable in TS via `omitClaudeMd: true`).
- **Unbounded (12 concurrent):** Theoretical $60\text{s}$ critical path, but likely triggers org TPM `429` backoffs in practice.

### 2. Python Agent SDK supervisor with bounded fan-out, fail-closed hook, HITL gate, and structured output

*Status: SDK-aligned reference code (`claude-agent-sdk` v0.2.127+ / v0.2.177+ signatures verified from docs; requires live Claude Code CLI & API key to run).*

```python
import asyncio
from pydantic import BaseModel
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition, ResultMessage
from claude_agent_sdk.types import (
    HookMatcher,
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)


class AuditReport(BaseModel):
    service: str
    critical_findings: list[str]
    requires_hotfix: bool


async def enforce_read_only_bash(input_data: dict, tool_use_id: str | None, context):
    if input_data.get("hook_event_name") != "PreToolUse":
        return {}
    cmd = input_data.get("tool_input", {}).get("command", "")
    if any(tok in cmd for tok in ("rm ", "curl ", "git push")):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Blocked unsafe shell command in audit run.",
            }
        }
    return {}


async def hitl_approval(
    tool_name: str, input_data: dict, context: ToolPermissionContext
) -> PermissionResultAllow | PermissionResultDeny:
    if tool_name == "AskUserQuestion":
        answers = {q["question"]: q["options"][0]["label"] for q in input_data.get("questions", [])}
        return PermissionResultAllow(
            updated_input={"questions": input_data.get("questions", []), "answers": answers}
        )
    approved = False  # Replace with async UI/Slack approval lookup
    if approved:
        return PermissionResultAllow(updated_input=input_data)
    return PermissionResultDeny(message=f"Human approval required before executing {tool_name}.")


async def run_audit():
    options = ClaudeAgentOptions(
        model="claude-opus-4-7",
        permission_mode="default",
        allowed_tools=["Read", "Glob", "Grep", "Agent"],
        disallowed_tools=["Agent(fork)"],
        max_turns=25,
        max_budget_usd=3.50,
        env={
            "CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS": "1",
            "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1",
            "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "4",
        },
        agents={
            # AgentDefinition uses camelCase wire fields in Python.
            "service-auditor": AgentDefinition(
                description="Audits a single service directory for auth flaws and returns concise findings.",
                prompt=(
                    "Audit only the assigned directory. Write detailed evidence to /tmp/audit_notes.md "
                    "if >500 words, and return only a concise summary of critical flaws."
                ),
                tools=["Read", "Glob", "Grep"],
                model="sonnet",
                maxTurns=10,
                effort="medium",
            ),
        },
        hooks={
            "PreToolUse": [
                HookMatcher(matcher="Bash", hooks=[enforce_read_only_bash], on_failure="block"),
            ]
        },
        can_use_tool=hitl_approval,
        output_format={"type": "json_schema", "schema": AuditReport.model_json_schema()},
    )

    try:
        async for msg in query(
            prompt="Dispatch service-auditor subagents in parallel for services/auth and services/billing.",
            options=options,
        ):
            if isinstance(msg, ResultMessage):
                if msg.subtype == "success" and msg.structured_output:
                    print(AuditReport.model_validate(msg.structured_output).model_dump_json(indent=2))
                else:
                    print(f"Stopped: {msg.subtype}; cost=${msg.total_cost_usd}")
    except Exception as exc:
        print(f"Audit loop terminated: {exc}")


asyncio.run(run_audit())
```

## Diagram spec

### Diagram 1: Six-Step Permission & HITL Evaluation Flow (flow)

- **Nodes:** `ToolCall` ("Tool call: parent or subagent"), `Step1` ("1. PreToolUse Hooks (`onFailure: block`)"), `Step2` ("2. Deny Rules (`disallowed_tools`)"), `Step3` ("3. Ask Rules / `always_ask` / `AskUserQuestion`"), `Step4` ("4. Permission Mode"), `Step5` ("5. Allow Rules (`allowed_tools` / read-only)"), `Step6` ("6. `canUseTool` Callback"), `Defer` ("Exit Turn: `stop_reason = tool_deferred`"), `Exec` ("Execute Tool"), `Block` ("Blocked -> Error to Agent").
- **Edges:** `ToolCall -> Step1`; `Step1 --deny--> Block`; `Step1 --defer--> Defer`; `Step1 --allow/pass--> Step2`; `Step2 --match--> Block`; `Step2 --no match--> Step3`; `Step3 --match--> Step6`; `Step3 --no match--> Step4`; `Step4 --acceptEdits/bypass--> Exec`; `Step4 --default/dontAsk--> Step5`; `Step5 --match--> Exec`; `Step5 --no match--> Step6`; `Step6 --allow (+updatedInput)--> Exec`; `Step6 --deny or dontAsk--> Block`.
- **Caption:** Tool calls from parent and subagents traverse six ordered checks where `PreToolUse` hooks and deny rules enforce non-bypassable boundaries while earlier approvals short-circuit `canUseTool`.

### Diagram 2: Context-Isolated Orchestrator-Worker with Artifact Bypass (sequence)

- **Actors:** `Coordinator`, `Subagent_A`, `Subagent_B`, `ArtifactStore`.
- **Messages:** `Coordinator -> Subagent_A`: `Agent(auditor, "Audit auth/; store full log")`; `Coordinator -> Subagent_B`: `Agent(auditor, "Audit billing/; store full log")` (parallel); `Subagent_A -> ArtifactStore`: write `artifacts/auth.json`; `Subagent_B -> ArtifactStore`: write `artifacts/billing.json`; `Subagent_A --> Coordinator`: scanned summary + ref `artifacts/auth.json`; `Subagent_B --> Coordinator`: scanned summary + ref `artifacts/billing.json`.
- **Caption:** Parallel subagents absorb noisy intermediate tool outputs in isolated contexts and persist large artifacts externally, returning only scanned compact references to the coordinator.

## Exam lens

*(Editorial inference — decision patterns derived from the blueprint and Anthropic guidance, not real exam items.)*

1. **Fixing "telephone game" pipelines:** When a role-split chain (`Planner -> Coder -> Tester -> Reviewer`) wastes tokens and drops requirements across handoffs, consolidate tightly coupled work into **context-centric** component agents and isolate only independent slices or black-box verification (F13, F14).
2. **Deterministic guardrails across subagents:** Extending the Guide §7 pattern (enforcing deterministic controls outside the model), if a policy check sits in `canUseTool` alongside `allowed_tools` or `bypassPermissions`, or a subagent relies on `permissionMode: "default"` under an `acceptEdits` parent, the check is bypassed (F23, F24). Move enforcement to `PreToolUse` (`on_failure="block"`) and `disallowed_tools` (F17, F26).
3. **Selecting Subagents vs. Dynamic Workflows vs. Agent Teams:** Use **Dynamic Workflows** for 50–500-item fan-outs so loops/intermediate results stay out of coordinator context (F31, F34); **Agent Teams** only for interactive peer debate (F30); **Subagents** for bounded hub-and-spoke delegation (F15).
4. **Async HITL & surgical cancellation:** Use `PreToolUse` `"defer"` (`stop_reason: "tool_deferred"`) to avoid holding serverless processes open during human approvals (F27); use Managed Agents `user.interrupt` with `session_thread_id` to stop one misbehaving worker without killing siblings (F33).

## Common mistakes

- **Putting security policies in `canUseTool`:** Auto-approved tools skip `canUseTool` (F23); enforce mandatory policies in `PreToolUse` (`on_failure="block"`) or `disallowed_tools` (F23, F26).
- **Expecting `AgentDefinition.permissionMode` to restrict a permissive/plan parent:** Subagents inherit `plan`, `acceptEdits`, `auto`, or `bypassPermissions` from the parent, overriding their own `permissionMode` (F24).
- **Using snake_case in Python `AgentDefinition`:** Passing `disallowed_tools` or `max_turns` to `AgentDefinition` raises `TypeError` (camelCase required) (F19).
- **Calling `AskUserQuestion` from a subagent:** `AskUserQuestion` is stripped from `Agent`-spawned subagents (F25).
- **Omitting `...process.env` in TS `env` or forgetting depth/budget caps:** TS `env` replaces the subprocess environment (breaking `PATH`); unconfigured depth/budget lets subagents recurse 3 layers deep up to 20 concurrent workers (F18).
- **Equating `workflow_run.status_ended: completed` with zero thread failures:** Managed Agents workflow runs can complete even when handled child threads failed; inspect per-thread events (F34).
- **Using `Agent Teams` in headless/SDK runs:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is ignored in `-p`/SDK, and in-process teammates do not survive `/resume` (F30).

## Self-check

1. **Q:** A parent session in `acceptEdits` mode spawns a subagent with `AgentDefinition(..., permissionMode="default")`. Will `Edit` calls inside the working directory trigger `canUseTool`?
   **A:** No—the subagent inherits `acceptEdits` from the parent, auto-approving `Edit` before `canUseTool` runs (F23, F24). Gate it via a `PreToolUse` hook instead (F23).
2. **Q:** Why can 20 parallel subagents take longer wall-clock time than waves of 4–5?
   **A:** Workers share org RPM/TPM rate limits and (without `isolation: worktree`) a workspace (F28, F34). High concurrency triggers `429` backoffs and sequential mutating-tool serialization while synchronous barriers still wait on the slowest straggler (F11, F20, F34).
3. **Q:** How do you pause a `-p` single-tool-call run for an external approval taking hours without keeping the process alive?
   **A:** Return `permissionDecision: "defer"` from a `PreToolUse` hook; the run exits with `stop_reason: "tool_deferred"` and `deferred_tool_use`, then resumes via `--resume <session_id>` (F26, F27).

## Unresolved

- **Python vs. TypeScript SDK parity gaps:** Python `AgentDefinition` omits `autoCompactWindow` and `omitClaudeMd` (TS-only), and several hook events (`TeammateIdle`, `TaskCreated`, `TaskCompleted`, `SessionStart`, `SessionEnd`, `PostToolBatch`, `PermissionDenied`) are TS-only in SDK callbacks.
- **`Workflow` tool in Python Agent SDK:** Documented for TS Agent SDK (`v0.3.149+`) and CLI; Python Agent SDK programmatic support was not verified in the Python reference.
- **Managed Agents beta status:** Multiagent orchestration, session threads, and workflow runs are beta (`managed-agents-2026-04-01`) and ineligible for ZDR/HIPAA (except self-hosted Managed Agents for ZDR).
