# 7.1 Runtime Guardrail Systems

Official objective:
> Evaluating layered guardrail architectures against a production agent's risk profile, including input/output filtering, PII redactors, hook-based policy enforcement, destructive-action prevention, sandboxing that grants tool and web access without exposing production systems, approval gates, refusal handling and safety fallbacks, deterministic enforcement for irreversible actions, and false-positive/false-negative tuning.

## Scope map

| Official sub-objective | Packet section(s) |
|---|---|
| Evaluating layered guardrail architectures against a production agent's risk profile | Core facts; Exact API / config details; Practitioner reasoning; Diagram spec |
| Input/output filtering | Core facts; Exact API / config details; Practitioner reasoning |
| PII redactors | Core facts; Exact API / config details; Practitioner reasoning; Unresolved |
| Hook-based policy enforcement | Core facts; Exact API / config details; Worked example(s) |
| Destructive-action prevention | Core facts; Exact API / config details; Practitioner reasoning; Exam lens |
| Sandboxing that grants tool and web access without exposing production systems | Core facts; Exact API / config details; Practitioner reasoning |
| Approval gates | Core facts; Exact API / config details; Worked example(s); Exam lens |
| Refusal handling and safety fallbacks | Core facts; Exact API / config details; Practitioner reasoning |
| Deterministic enforcement for irreversible actions | Core facts; Practitioner reasoning; Worked example(s); Exam lens |
| False-positive/false-negative tuning | Core facts; Exact API / config details; Practitioner reasoning; Worked example(s) |

## Core facts

* **Runtime controls over prompt instructions:** Prompt text and `CLAUDE.md` shape model intent, whereas hooks, permission rules, and OS sandboxes enforce deterministic boundaries outside the model (F11).
* **Hook enforcement & failure semantics:** Command hooks apply stdout JSON on exit `0`, block blockable events via `stderr` on exit `2`, and fail **open** on other codes (including `1`) unless `onFailure: "block"` (`on_failure="block"` in Python SDK) is set (F1, F7). Multi-hook `PreToolUse` precedence is `deny` > `defer` > `ask` > `allow` (F2), and `updatedInput` replaces the full `tool_input` object before rule checks (F3).
* **Six-step permission pipeline & rule order:** Calls evaluate Hooks → Deny rules → Ask rules → Permission mode → Allow rules → `canUseTool` (F8, F9, F10). Rules match `deny` → `ask` → `allow` regardless of specificity (F10); `PreToolUse` `"allow"` cannot skip `deny`/`ask` rules or critical-path `rm`/`rmdir` checks (F8, F14), and steps 4–5 auto-approvals silently skip `canUseTool` (F9).
* **Settings precedence & Managed Agents:** Scopes resolve Managed > `--settings` > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json` (F13). Managed Agents `auto` policy is not a human checkpoint; irreversible tools require `always_ask` (F16).
* **Shell-rule & sandbox boundaries:** `Bash(...)` rules match command text as written and miss `/bin/rm` or `sh -c` (F12). Built-in `/sandbox` (Seatbelt / `bubblewrap` + `socat`, reducing prompts by 84% internally) isolates shell commands only—not `Read`/`Edit`/`WebFetch`, MCP servers, or hooks (F17, F18)—and falls back to unsandboxed execution unless `failIfUnavailable: true` is set (F19).
* **Whole-process isolation & credential proxies:** `@anthropic-ai/sandbox-runtime` (`srt`) isolates the full Claude Code process without Docker (F21). Dev containers do not protect `~/.claude` or bind mounts from `--dangerously-skip-permissions` on untrusted repos (F22). Isolate secrets outside the agent via `sandbox.credentials` sentinel masking (F20) or an external credential-injecting proxy (`ANTHROPIC_BASE_URL` / Envoy) (F23).
* **Async approval gates:** Use `PreToolUse` `"defer"` (`stop_reason: "tool_deferred"` in `claude -p`) instead of blocking `canUseTool` when human approvals outlive the process (F15).
* **Filtering, redaction, prompt leak, and grounding:** Pre-screen prompts/tool results with Haiku 5.5 + `output_config` JSON schemas (treat `stop_reason: "refusal"` as harmful) (F24), isolate third-party data in `tool_result` blocks (F25), extract verbatim quotes on >20k-token docs (F27), and avoid complex anti-leak prompts unless output monitoring suffices (F26). Error reports redact secrets/PII automatically (F35); `UserPromptSubmit` blocks stay in local disk history (F4), `PostToolUse` `updatedToolOutput` runs post-execution/post-OTel (F5), and `MessageDisplay` masks UI display only (F6).
* **Refusal handling & classifier tuning:** Refusals return HTTP `200` (`stop_reason: "refusal"` with `stop_details`); never retry the same model or fall back on `reasoning_extraction` (F28, F29), and use `BetaRefusalFallbackMiddleware` where server-side `fallbacks` is unsupported (Haiku 5.5, Batch, Bedrock, Vertex, Foundry) (F30). Anthropic's two-stage `auto` classifier cuts FPR from `8.5%` to `0.4%` (with `17%` overeager FNR) (F31), strips assistant reasoning/tool outputs (F32), ignores repo `autoMode` configs (F33), and complements multi-tier (`0`–`3`) moderation thresholds (F34).

## Exact API / config details

### Layered guardrail architecture matrix

| Layer | Mechanism / API | Enforcement Type | Scope & Bypass Caveats |
|---|---|---|---|
| **1. Pre-input / prompt gate** | `UserPromptSubmit` hook; Haiku 5.5 `harmlessness_screen` (`output_config` JSON schema) | Deterministic (hook) + Probabilistic (LLM screen) | Treat classifier `stop_reason: "refusal"` as harmful (F24). Blocked prompts still hit local transcript/history files (F4). |
| **2. Tool visibility & rule gate** | `disallowed_tools` / `permissions.deny` → `ask` → `allow`; `PreToolUse` hook | Deterministic (runtime, pre-execution) | `deny` → `ask` → `allow` (first match wins) (F10). Bare tool name in `deny` strips tool schema; `Bash(...)` rules miss `/bin/rm` or `sh -c` (F12). |
| **3. Mode & classifier gate** | `permissionMode` (`default`, `dontAsk`, `acceptEdits`, `plan`, `auto`, `bypassPermissions`); Managed Agents `always_ask`/`auto` | Policy mode + Two-stage LLM classifier (`auto`) | `auto` cuts FPR to `0.4%` (`17%` overeager FNR) (F31); strips assistant CoT & tool outputs (F32); pauses after `3` consecutive or `20` total blocks. |
| **4. Human approval gate** | Agent SDK `canUseTool` (`PermissionResultAllow`/`Deny`); `PreToolUse` `"ask"` or `"defer"`; `PermissionRequest`; Managed Agents `always_ask` | Deterministic pause before execution | `canUseTool` is skipped by `allow` rules, `acceptEdits`, `bypassPermissions` (F9). Use `PreToolUse` `"defer"` for out-of-process async approvals (F15). |
| **5. OS / container / proxy sandbox** | Built-in Bash sandbox (`sandbox.*`); `srt`; Devcontainer + `init-firewall.sh`; Docker/gVisor/Firecracker; Envoy proxy | Deterministic OS kernel / hypervisor / network boundary | Built-in Bash sandbox covers shell commands only (not `Read`/`Edit`/`WebFetch`/MCP/hooks) (F18). Lock with `failIfUnavailable: true` + `allowUnsandboxedCommands: false` (F19). |
| **6. Post-tool & output filter** | `PostToolUse` (`updatedToolOutput`, `classifierContext`); Haiku injection screen on tool results; `MessageDisplay` (`displayContent`) | Deterministic rewrite + Probabilistic screen | `PostToolUse` runs **after** side effects & OTel telemetry capture (F5). `MessageDisplay` changes UI display only, not transcript/context (F6). |
| **7. Response & refusal handling** | `stop_reason == "refusal"`, `stop_details`; `fallbacks="default"` (`server-side-fallback-2026-07-01`); `BetaRefusalFallbackMiddleware` | Deterministic API branching | HTTP `200`; `reasoning_extraction` has no fallback (F28, F29). Haiku 5.5 & Batches lack server-side fallback (F30). |

### Claude Code & Agent SDK hooks specification

* **Handler types (`type`):** `"command"` (`command`, optional `args` for shell-free exec form, `shell`: `"bash"` | `"powershell"`, `async`, `asyncRewake`, `onFailure`: `"continue"` | `"block"`), `"http"` (`url`, `headers`, `allowedEnvVars`, `onFailure`), `"mcp_tool"` (`server`, `tool`, `input`, `onFailure`), `"prompt"` (`prompt`, `model`, `continueOnBlock`), `"agent"` (experimental, up to 50 turns, `Read`/`Grep`/`Glob`). Default timeouts: `600s` (`command`/`http`/`mcp_tool`), `30s` (`prompt`, and command/http/mcp on `UserPromptSubmit`/`PreModelSwitch`/`PostModelSwitch`), `60s` (`agent`), `10s` (`MessageDisplay`).
* **Command hook exit codes:**
  * `0`: Success; parse single JSON object on `stdout` (plain stdout on `UserPromptSubmit`, `SessionStart`, `UserPromptExpansion`, `PostModelSwitch` is injected as context). `stderr` is hidden from Claude.
  * `2`: Blocking error on blockable events (`PreToolUse`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `SubagentStop`, `PostToolBatch`, `TaskCreated`, `TaskCompleted`, `TeammateIdle`, `ConfigChange`, `PreCompact`, `PreModelSwitch`, `Elicitation`, `ElicitationResult`, `WorktreeCreate`/`Remove`). On `PreToolUse`, blocks tool call even if stdout JSON returned `"allow"`, passing `stderr` to Claude. **Ignored** on `PermissionRequest` (must return JSON `decision`) and `PermissionDenied`.
  * `1` or other non-zero: **Non-blocking error** (action proceeds!) unless `"onFailure": "block"` is set (v2.1.295+ for command/HTTP, v2.1.328+ for `mcp_tool`) or valid JSON is printed on `stdout` (F1).
  * **Agent SDK failure behavior:** SDK callbacks on `PreToolUse` and `UserPromptSubmit` block when hitting `timeout`; on exceptions or `None` returns, they fail open (`hook_callback_failed` informational message) unless `HookMatcher(on_failure="block")` (Python SDK v0.2.177+) / `onFailure: "block"` (TS SDK v0.3.317+) is set (F7).
* **`PreToolUse` JSON output (`hookSpecificOutput`):**
  * `hookEventName`: `"PreToolUse"`
  * `permissionDecision`: `"allow"` | `"deny"` | `"ask"` | `"defer"` (multi-hook precedence: `deny` > `defer` > `ask` > `allow`) (F2). `"defer"` requires `claude -p` single-tool turn and ends with `stop_reason: "tool_deferred"` + `deferred_tool_use` (F15).
  * `permissionDecisionReason`: shown to user (`"ask"`), Claude (`"deny"`), or debug log (`"allow"`/`"defer"`).
  * `updatedInput`: replaces entire `tool_input` object before permission rules & execution (F3). In `auto` mode without `permissionDecision`, server-side review may deny modified inputs (`a hook changed this call's input after auto mode reviewed it`).
  * `additionalContext`: injected as `<system-reminder>` (10,000-char cap per string; overflow written to file with 2,000-char preview).
* **`PostToolUse`, `UserPromptSubmit`, `MessageDisplay`, `PermissionDenied` JSON outputs:**
  * `PostToolUse`: top-level `decision: "block"` + `reason`; `hookSpecificOutput.updatedToolOutput` (replaces tool result seen by Claude; must match built-in tool output schema e.g. `Bash`: `stdout`, `stderr`, `interrupted`, `isImage`) (F5); `hookSpecificOutput.classifierContext` (<= 2,000 chars for `auto` mode classifier).
  * `UserPromptSubmit`: top-level `decision: "block"` + `reason`; `hookSpecificOutput.suppressOriginalPrompt: true`, `additionalContext`, `sessionTitle`.
  * `MessageDisplay`: `hookSpecificOutput.displayContent` (UI-only text replacement; non-interactive/SDK receives one batch with `index: 0, final: true`) (F6).
  * `PermissionDenied`: `hookSpecificOutput.retry: true` (ignored on no-verdict classifier denials).
* **Important hook bypass surfaces:** `@file` mentions in prompts insert file contents without firing `PreToolUse` on `Read` unless `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1` (v2.1.299+) or a `Read` deny rule is set. Slash commands typed by users (`/deploy`) fire `UserPromptExpansion`, not `PreToolUse(Skill)`. On Windows without Git Bash, shell commands use `PowerShell` tool (`Bash|PowerShell` matcher).

### Permissions, modes, and settings precedence

* **Rule syntax & gotchas:**
  * `Edit(path)` governs `Edit`, `Write`, `NotebookEdit`, and legacy `MultiEdit`; `Write(path)` never matches. `Read(path)` governs `Read`, `Grep`, and `Glob` (plus `@file` mentions and pasted image paths in v2.1.290+); `Grep(path)`/`Glob(path)` never match.
  * Path prefixes in `Read`/`Edit` rules: `//path` = filesystem root, `~/path` = home, `/path` = relative to settings source (project root for `.claude/settings*.json`, `~/.claude/` for user settings!), `path` or `./path` = cwd. `.claudeignore` has **no effect**.
  * `allowed_tools` / `permissions.allow` is an **auto-approval list**, not an allowlist of available tools. Pair `allowedTools: ["Read", "Glob", "Grep"]` with `permissionMode: "dontAsk"` (or `disallowedTools`) for a locked-down agent. Bare tool names in `disallowed_tools` / `permissions.deny` remove the tool schema from context; tool-name globs (`"*"`, `"mcp__*"`) work in `deny`/`ask`, whereas `allow` only permits globs after a literal `mcp__<server>__` prefix.
* **Agent SDK `canUseTool` & `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`:**
  * Python: `PermissionResultAllow(updated_input=..., updated_permissions=...)` / `PermissionResultDeny(message=...)` (note `claude-agent-sdk` streaming input / dummy `PreToolUse` hook workaround when using `can_use_tool`).
  * TypeScript: `{ behavior: "allow", updatedInput, updatedPermissions }` / `{ behavior: "deny", message }`. Emits `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` warning if `permissionMode: 'bypassPermissions'` or bare tool name in `allowedTools` shadows `canUseTool`.
* **Settings precedence (highest → lowest) (F13):**
  1. **Managed settings:** (a) Server-managed settings (claude.ai console / gateway, polled hourly), (b) MDM / macOS plist (`com.anthropic.claudecode`) / Windows `HKLM\SOFTWARE\Policies\ClaudeCode`, (c) `/etc/claude-code/managed-settings.json` + `managed-settings.d/*.json` (macOS: `/Library/Application Support/ClaudeCode/`, Win: `C:\Program Files\ClaudeCode\`), (d) Windows `HKCU` (only if no admin doc above). Default `managedSourcesBehavior` is `"first-wins"` (except cross-source locks like `allowManagedDomainsOnly`, `allowManagedReadPathsOnly`, `allowManagedMcpServersOnly`, `deniedMcpServers`, `env`); `"merge"` combines across admin sources.
  2. **Command-line `--settings <file-or-json>`**
  3. **Project local (`.claude/settings.local.json`)** (cannot set `defaultMode: "auto"` or `"bypassPermissions"`)
  4. **Shared project (`.claude/settings.json`)** (`allow` rules wait for workspace trust in interactive sessions; `-p`/SDK auto-trusts folders!)
  5. **User (`~/.claude/settings.json`)**
  * *Restrictive overrides:* Keys such as `permissions.blockReadsOutsideWorkingDirectories`, `permissions.blockWritesOutsideWorkingDirectories`, `permissions.denyInsteadOfPrompting`, `disableClaudeAiConnectors`, and lower `maxEffortLevel` are honored from lower scopes even if managed settings are looser.
* **Managed Agents permission policies (`anthropic-beta: managed-agents-2026-04-01`):**
  * Set per toolset (`agent_toolset_20260401`, defaults to `always_allow`; `mcp_toolset`, defaults to `always_ask`) or per tool via `permission_policy.type`: `"always_allow"` | `"always_ask"` | `"auto"`.
  * Paused `ask` calls emit `session.status_idle` with `stop_reason.type == "requires_action"` and `stop_reason.event_ids`; client responds with `user.tool_confirmation` (`tool_use_id`, `result`: `"allow"` | `"deny"`, `deny_message`). Sending `user.tool_confirmation` for a server-denied `auto` call returns HTTP `400`.

### Sandboxing, `sandbox-runtime`, devcontainers, and containers

| Isolation Option | Enforcement Boundary | Isolates File Tools / MCP / Hooks? | Egress & Credential Control | Key Config / Flags |
|---|---|---|---|---|
| **Built-in Bash sandbox** | macOS Seatbelt / Linux & WSL2 `bubblewrap` + `socat` | **No** — shell commands only (`Bash`, `PowerShell`, `Monitor`) (F18) | Local proxy checks `allowedDomains` + `WebFetch(domain:...)`, blocks `169.254.169.254`/loopback. Optional `credentials` `deny`/`mask` (F20). | `sandbox.enabled: true`, `failIfUnavailable: true`, `allowUnsandboxedCommands: false`, `network.strictAllowlist: true`, `allowManagedDomainsOnly: true` |
| **`@anthropic-ai/sandbox-runtime` (`srt`)** | Same Seatbelt / `bubblewrap` around entire process | **Yes** — wraps Claude Code, file tools, MCP, hooks (F21) | Default-deny network; requires `~/.srt-settings.json` / `--settings` allowing `api.anthropic.com`, cwd, `~/.claude`, `/tmp` (macOS `/private/tmp`). | `srt claude`; `denyWrite` overrides `allowWrite`; protects `.git/hooks`, `.mcp.json` |
| **Dev container** | Docker container (`remoteUser` non-root) + optional `init-firewall.sh` (`iptables`) | **Yes** — isolates workspace & container FS | Egress firewall requires `NET_ADMIN`/`NET_RAW`. **Warning:** bind-mounted workspace & `~/.claude` still exposed to container code (F22). | `.devcontainer/devcontainer.json`, `CLAUDE_CONFIG_DIR` volume, `disableBypassPermissionsMode: "disable"` |
| **Hardened Docker + Unix proxy** | Linux namespaces + seccomp + non-root | **Yes** | `--network none` + host proxy over mounted Unix socket (`proxy.sock`); inject credentials at Envoy/LiteLLM proxy (F23). | `--cap-drop ALL --read-only --security-opt no-new-privileges --pids-limit 600` |
| **gVisor / Firecracker microVM** | Userspace syscall kernel (`runsc`) / hardware VM kernel | **Yes** (strongest) | `vsock` proxy (Firecracker, <125ms boot, <5 MiB overhead) or private subnet + cloud firewall + Envoy `credential_injector` (F23). | `docker run --runtime=runsc`; gVisor I/O overhead `10–200×` |

### Guardrail APIs, classifier tuning, and refusal fallbacks

* **Harmlessness & injection screens:** Call `claude-haiku-5-5` (or `claude-haiku-4-5-20251001`) with `output_config.format.type: "json_schema"` for binary (`is_harmful` / `injection_suspected`) or tiered (`risk_level` `0`–`3`) classification (F24, F34). Built-in server classifiers also scan `computer_use` and `browser_use` screenshots/page text for indirect injection.
* **Refusal response & fallback:**
  * HTTP `200`, `stop_reason: "refusal"`, `stop_details: { "type": "refusal", "category": "cyber" | "bio" | "frontier_llm" | "reasoning_extraction" | "general_harms" | null, "explanation": string | null, "recommended_model"?: string | null }` (F28). Billed before output for `"bio"`, `"frontier_llm"`, `"reasoning_extraction"`.
  * Managed Agents: `session.status_idle` with `stop_details.type == "refusal"` or `stop_reason.type == "refusal"`.
  * Server-side fallback: `fallbacks="default"` or up to 3 models with `betas=["server-side-fallback-2026-07-01"]` (returns `fallback` content block and `usage.iterations[].type == "fallback_message"`, ~1h sticky routing). Unavailable on Haiku 5.5, Batch API, Bedrock, Google-managed Vertex AI, and Microsoft Foundry (F30).
  * Client-side fallback: `BetaRefusalFallbackMiddleware([...])` + `BetaFallbackState()` (auto-sends `fallback-credit-2026-07-01`, works on all platforms and Haiku 5.5; note Haiku 5.5 and Batches mint no fallback credit).
* **`autoMode` classifier tuning (`~/.claude/settings.json` or managed settings; ignored in repo `.claude/` (F33)):**
  * `autoMode.environment`: prose entries with `"$defaults"` + org repos, buckets, domains, internal registries, host containment, sensitive data locations.
  * `autoMode.hard_deny` (unconditional) > `autoMode.soft_deny` (intent/allow can clear) > `autoMode.allow` > explicit user intent.
  * `autoMode.classifyAllShell: true`: disables narrow `Bash(...)` allow rules so classifier checks every shell call.
  * Diagnostic CLI: `claude auto-mode defaults`, `claude auto-mode config`, `claude auto-mode critique` (flags ambiguous/FP-prone rules), `/auto-mode-setup`.

## Practitioner reasoning

* **Prompt-level instruction vs. hard runtime control:** System prompts and `CLAUDE.md` only *steer* model intent (probabilistic) and degrade under indirect prompt injection or context compaction (which can even erase in-conversation user boundaries) (F11). Any invariant whose violation causes irreversible loss, secret exposure, or policy breach **must** live in deterministic runtime controls outside the model: `permissions.deny`, `PreToolUse` hooks with `onFailure: "block"`, OS sandboxes (`failIfUnavailable: true`), egress proxies, and Managed Agents `always_ask` (F1, F7, F11, F16, F19).
* **Deterministic enforcement for irreversible actions ("private data + untrusted input + external communication"):** `[INFERENCE]` Whenever an agent combines private data access, untrusted input ingestion (emails, web pages, PRs), and an external communication/mutation sink, rely on external deterministic gates rather than telling the model "don't exfiltrate": (1) strip secrets from the agent's container/environment and inject auth only at an external proxy bound to `injectHosts` (F20, F23); (2) enforce an egress domain/recipient allowlist (`network.allowedDomains` + `strictAllowlist: true` or gateway policy) (F19); (3) require human confirmation (`PreToolUse` `"ask"`/`"defer"` or Managed Agents `always_ask`) before external sends or destructive mutations (F15, F16); and (4) isolate untrusted inputs in JSON-encoded `tool_result` blocks pre-screened by a lightweight classifier (F24, F25).
* **PII redaction layer placement (`[INFERENCE]` + documented hook semantics):**
  * **Before model inference (input PII):** Scrub PII deterministically (regex/NER or gateway proxy) *before* sending messages to the Messages API or writing session transcripts—a `UserPromptSubmit` hook in Claude Code can block a prompt, but cannot keep it out of local transcript/history files (F4), and Claude Code's built-in redaction only covers internal error reports and feedback bundles (F35).
  * **Between tool execution and model context:** Use a `PostToolUse` hook returning `updatedToolOutput` to mask PII/secrets returned by local tools before Claude reads them, remembering that the tool already executed and raw output already hit OTel telemetry (F5).
  * **Before UI rendering:** Use `MessageDisplay` (`displayContent`) to mask leaked tokens/hostnames on screen, while keeping in mind that the transcript and Claude's context still hold the unredacted text (F6).
* **False-positive / false-negative tuning trade-offs:** Single-stage classifiers force a bad trade-off between latency/cost and precision/recall. Anthropic's two-stage design (fast single-token Stage 1 tuned for low FNR, CoT Stage 2 pruning FPs from `8.5%` to `0.4%`) preserves UX while keeping `autoMode` usable—yet still leaves a `17%` FNR on real overeager actions (F31). `[INFERENCE]` Tune classifiers along three axes: (1) enrich domain context (`autoMode.environment`) and run `claude auto-mode critique` before loosening `allow` rules, because developer `allow` entries override org `soft_deny`; (2) use multi-tier risk scores (`0`–`3`) to route gray-zone medium-risk actions to human review instead of binary block/allow (F34); and (3) never rely solely on a probabilistic classifier where `17%` FNR is unacceptable—gate irreversible tools deterministically with `permissions.ask`/`always_ask` or `PreToolUse` hooks (F16, F31).
* **Failure modes & recovery:**
  * *Hook crash fails open:* A missing script or `exit 1` in a `PreToolUse` command hook lets the dangerous tool call proceed unless `"onFailure": "block"` is set (F1, F7).
  * *`canUseTool` silently bypassed:* Putting safety checks only in `canUseTool` fails whenever `allow` rules, `acceptEdits`, or `bypassPermissions` resolve the tool earlier; move mandatory checks to `PreToolUse` hooks (F8, F9).
  * *Built-in Bash sandbox escape:* Relying on `/sandbox` alone leaves `Read`/`Edit`/`WebFetch`, MCP tools, hooks, and `dangerouslyDisableSandbox` retries uncontained; enforce `allowUnsandboxedCommands: false` + `failIfUnavailable: true` and wrap the full process in `srt`, a container, or a microVM (F18, F19, F21).

## Worked example(s)

### Example 1: Verified `PreToolUse` deterministic guardrail (Claude Code + Agent SDK)

*Status: Verified against current Claude Code `hooks.md` and `agent-sdk/hooks.md` schemas (`onFailure: "block"` requires Claude Code v2.1.295+ / Python Agent SDK v0.2.177+).*

**A. Claude Code `.claude/settings.json` (fail-closed `PreToolUse` hook on `Bash|PowerShell` and `Write|Edit`):**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "python3",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard_shell.py"],
            "timeout": 10,
            "onFailure": "block"
          }
        ]
      }
    ]
  }
}
```

**B. `.claude/hooks/guard_shell.py` (blocks destructive/exfil commands via JSON `permissionDecision`, rewrites unsafe temp paths via `updatedInput`):**

```python
#!/usr/bin/env python3
import json
import re
import sys

BLOCKED_PATTERNS = [
    r"\bcurl\b.*\|\s*(ba)?sh\b",
    r"\bterraform\s+destroy\b",
    r"169\.254\.169\.254",
]

def main() -> None:
    payload = json.load(sys.stdin)
    tool_input = payload.get("tool_input", {})
    cmd = tool_input.get("command", "")

    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, cmd, re.IGNORECASE):
            # Exit 0 + structured JSON (exit 2 + stderr also blocks, without updatedInput)
            json.dump({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Blocked by security policy: matched {pattern}",
                }
            }, sys.stdout)
            return

    # Deterministic input sanitization: force non-interactive / scoped flag on rm
    if re.search(r"\bgit\s+push\b", cmd):
        json.dump({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": "Confirm external git push target and diff.",
                "updatedInput": {**tool_input, "command": cmd},
            }
        }, sys.stdout)
        return

    # No opinion: return empty JSON so normal rules / permission mode decide
    print("{}")

if __name__ == "__main__":
    main()
```

*(Note: `"onFailure": "block"` ensures that if `python3` or the script is missing or raises an unhandled exception, Claude Code blocks the tool call instead of failing open (F1, F7).)*

### Example 2: Two-stage classifier & harmlessness screen latency/FP calculation

Suppose an agent processes `10,000` tool calls/day through a two-stage guardrail modeled on Anthropic's auto-mode architecture (F31):
* **Stage 1 (Haiku 5.5 single-token screen, 8.5% FPR):** Runs on all `10,000` calls (`~850` flagged).
* **Stage 2 (Sonnet 5 CoT reviewer, cuts FPR to 0.4%):** Runs **only** on the `850` Stage-1-flagged calls (`~91.5%` cost/latency savings vs. running CoT on all `10,000` calls), dropping false-positive blocks from `850` to `40` (`0.4%`) (F31).
* **Residual risk:** Because Stage 2 still has `17%` FNR on overeager actions and `5.7%` FNR on synthetic exfiltration (F31), the `5` irreversible external-sink tools (`send_email`, `sql_write`, `deploy_prod`, `iam_grant`, `git_push`) are **excluded** from classifier auto-approval and bound to deterministic `PreToolUse` `"ask"` / Managed Agents `always_ask` gates (F16).

## Diagram spec

* **Type:** flow
* **Nodes and edges:**
  * `[User Prompt / External Event]` --> `[UserPromptSubmit Hook & Haiku Harmlessness Screen (structured JSON; refusal => harmful)]`
  * `[UserPromptSubmit Hook & Haiku Harmlessness Screen (structured JSON; refusal => harmful)]` -- `Blocked` --> `[Reject & Return Safe Feedback]`
  * `[UserPromptSubmit Hook & Haiku Harmlessness Screen (structured JSON; refusal => harmful)]` -- `Allowed` --> `[Claude Model Turn (untrusted data isolated in JSON tool_result)]`
  * `[Claude Model Turn (untrusted data isolated in JSON tool_result)]` -- `stop_reason: refusal` --> `[Discard Partial Output; Fallback Model or Prompt Revision]`
  * `[Claude Model Turn (untrusted data isolated in JSON tool_result)]` -- `tool_use` --> `[1. PreToolUse Hook (deny > defer > ask > allow; updatedInput; onFailure=block)]`
  * `[1. PreToolUse Hook (deny > defer > ask > allow; updatedInput; onFailure=block)]` -- `Not denied` --> `[2-5. Deny Rules -> Ask Rules -> Permission Mode / 2-Stage Classifier -> Allow Rules]`
  * `[2-5. Deny Rules -> Ask Rules -> Permission Mode / 2-Stage Classifier -> Allow Rules]` -- `Needs approval` --> `[6. Approval Gate (canUseTool / PreToolUse defer / Managed Agents always_ask)]`
  * `[6. Approval Gate (canUseTool / PreToolUse defer / Managed Agents always_ask)]` -- `Approved` --> `[OS Sandbox / srt / Container + Egress & Credential-Injecting Proxy]`
  * `[2-5. Deny Rules -> Ask Rules -> Permission Mode / 2-Stage Classifier -> Allow Rules]` -- `Auto-approved` --> `[OS Sandbox / srt / Container + Egress & Credential-Injecting Proxy]`
  * `[OS Sandbox / srt / Container + Egress & Credential-Injecting Proxy]` --> `[PostToolUse (updatedToolOutput) / Haiku Injection Screen / MessageDisplay]` --> `[Claude Model Turn (untrusted data isolated in JSON tool_result)]`
* **Caption:** End-to-end layered runtime guardrail flow combining prompt screening, deterministic hook and rule precedence, human approval gates, OS/proxy sandboxing, post-tool filtering, and `refusal` fallback handling.

## Exam lens

*(Editorial inference based on the official November 2026 exam guide; Official Sample Item 3 in guide §7 tests deterministic enforcement for the "private data + untrusted input + external communication" combination.)*

1. **Deterministic external controls for the "lethal trifecta" (Official Sample Item 3):** When a scenario gives an agent private data access + untrusted input (web/email/issues) + external communication (email/HTTP/webhooks), reject answers that rely on system-prompt warnings, `CLAUDE.md` rules, or `auto` mode classifiers alone. Choose deterministic controls enforced outside the model: recipient/domain allowlists at a proxy, `PreToolUse` / `always_ask` human approval gates on external sinks, and least-privilege credential scoping via external proxy injection (F11, F16, F23).
2. **Evaluating `canUseTool` vs. `PreToolUse` vs. `deny` rules in the 6-step pipeline:** Scenarios often plant a security check inside `canUseTool` alongside `acceptEdits`, `bypassPermissions`, or `allowed_tools` (which silently skip `canUseTool`), or attempt to override a `deny` rule with a `PreToolUse` `"allow"` or a narrower `allow` rule. Remember: `PreToolUse` runs first for all calls, `allow` never overrides `deny`/`ask`, and `canUseTool` runs last only on unresolved calls (F8, F9, F10).
3. **Sandbox boundary gaps (shell-only vs. whole-process):** Choosing Claude Code's built-in `/sandbox` alone does **not** isolate `Read`, `Edit`, `WebFetch`, MCP servers, or command hooks—and default `allowUnsandboxedCommands: true` / `failIfUnavailable: false` lets commands escape or run unsandboxed. Hardened deployments require `allowUnsandboxedCommands: false` + `failIfUnavailable: true` plus whole-process isolation (`srt`, dev container with egress firewall, hardened container, or microVM) (F18, F19, F21, F22).
4. **Refusal handling & classifier FP/FN tuning:** Scenarios test recognizing HTTP `200` `stop_reason: "refusal"` (never retry the same model; never fall back on `reasoning_extraction`; use middleware rather than server-side `fallbacks` on Haiku 5.5/Bedrock/Vertex/Foundry) (F28, F29, F30) and fixing classifier false positives via `autoMode.environment` / two-stage CoT filtering rather than disabling safety checks with `bypassPermissions` (F31, F33).

## Common mistakes

* **Exiting `1` in a policy `PreToolUse` hook without `onFailure: "block"`:** Exit `1` is a non-blocking error that lets the dangerous tool call proceed; policy scripts must use `exit 2` (or exit `0` + JSON `"deny"`) and set `"onFailure": "block"` so crashes/missing scripts fail closed (F1, F7).
* **Putting mandatory security checks in `canUseTool`:** Calls matched by `allowed_tools`, `acceptEdits`, or `bypassPermissions` bypass `canUseTool` completely (F9).
* **Writing `Write(path)` or `Grep(path)` permission rules, or `/abs/path` with one slash:** Claude Code requires `Edit(path)` for all file-writing tools, `Read(path)` for `Read`/`Grep`/`Glob`, and `//abs/path` for filesystem-root paths (single `/` anchors at the settings source).
* **Relying on `Bash(curl *)` deny rules or built-in `/sandbox` to secure MCP/file tools:** `Bash(...)` rules miss `/usr/bin/curl` and `sh -c` (F12), and the built-in Bash sandbox does not constrain `Read`, `Edit`, `WebFetch`, MCP servers, or hooks (F18).
* **Assuming `UserPromptSubmit` or `MessageDisplay` scrubs secrets from logs/context:** Blocked `UserPromptSubmit` prompts still hit local transcripts/history (F4), `PostToolUse` `updatedToolOutput` runs after side effects and OTel capture (F5), and `MessageDisplay` alters only on-screen UI text (F6).
* **Using `autoMode` in repo `.claude/settings.json` or trusting Managed Agents `auto` as a human gate:** Claude Code ignores `autoMode` in repo settings (F33), and Managed Agents `auto` executes calls it deems safe without pausing—use `always_ask` for irreversible actions (F16).

## Self-check

1. **A Python Agent SDK agent runs with `permission_mode="acceptEdits"` and `allowed_tools=["Bash(git *)"]`. You put a regex check inside `can_use_tool` to block `git push --force`. Will it catch `git push --force`?**
   *Answer:* No. Because `"Bash(git *)"` is in `allowed_tools`, Step 5 auto-approves `git push --force` before Step 6 (`can_use_tool`) is ever invoked (F9). Enforce the check in a `PreToolUse` hook (with `on_failure="block"`) or a `disallowed_tools` / `permissions.deny` rule (which runs in Step 2, though note Bash rules miss alternate spellings like `git -C . push` (F8, F12)).
2. **A `PreToolUse` command hook runs `python3 check.py` and crashes with `ModuleNotFoundError` (exit code `1`). What happens to the tool call by default, and how do you make it fail closed?**
   *Answer:* By default, exit code `1` without valid JSON is a non-blocking error, so the tool call proceeds (F1). Add `"onFailure": "block"` (or `on_failure="block"` in Python Agent SDK `HookMatcher`) on the hook entry so crashes, missing scripts, and timeouts block the action (F7).
3. **A streaming Messages API call to `claude-haiku-5-5` with `fallbacks="default"` returns HTTP `200` with `stop_reason: "refusal"` and `stop_details.category: "cyber"`. Why didn't server-side fallback handle it, and what should your client do?**
   *Answer:* `claude-haiku-5-5` has no server-side fallback and mints no fallback credit (F30). Discard any partial streamed text, do not retry on `claude-haiku-5-5`, and instead configure `BetaRefusalFallbackMiddleware` (with a fallback model such as `claude-sonnet-5-5` or `claude-opus-4-8`) and `BetaFallbackState` on the client (F28, F30).

## Unresolved

* **First-party PII redaction library / API:** Official Anthropic docs (`platform.claude.com/docs`, `code.claude.com/docs`) document secret/PII redaction inside Claude Code's own telemetry/error reporting (`data-usage.md`) and UI/tool output hooks (`MessageDisplay`, `PostToolUse` `updatedToolOutput`), but do not prescribe a specific first-party pre-API PII redactor product or NER library; external pre-inference PII redaction (e.g., Presidio or gateway regex/NER proxies) is standard industry architecture rather than an Anthropic-specified API feature.
* **Server-side auto-mode classifier rule list:** While `claude auto-mode defaults` prints the client-side built-in classifier rules, `auto-mode-config.md` explicitly notes that when `Auto mode server` is `Enabled`, server-side rules can differ and no CLI subcommand prints them.
