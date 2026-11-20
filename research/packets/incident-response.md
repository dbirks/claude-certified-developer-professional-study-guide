# 4.2 Incident Response and Learning Loops

> **Official objective:** Evaluating incident-response options during an LLM-system outage or quality regression, including triage, mitigation, rollback, and communication, and converting the incident into regression evaluations, monitoring coverage, and postmortem findings.

## Scope map

| Sub-objective phrase | Packet section(s) |
|---|---|
| `Evaluating incident-response options during an LLM-system outage or quality regression` | Core facts, Practitioner reasoning, Worked example |
| `including triage` | Core facts, Practitioner reasoning, Worked example |
| `mitigation` | Core facts, Exact API / config details, Practitioner reasoning |
| `rollback` | Core facts, Exact API / config details, Practitioner reasoning |
| `and communication` | Core facts, Practitioner reasoning, Worked example |
| `and converting the incident into regression evaluations` | Core facts, Exact API / config details, Worked example |
| `monitoring coverage` | Core facts, Exact API / config details, Worked example |
| `and postmortem findings` | Core facts, Practitioner reasoning, Worked example |

## Core facts

### Incident triage, roles, and Anthropic vs. local isolation

- Incident management requires declaring incidents early, maintaining a clear command line, designating distinct roles, and keeping a living working record of debugging and mitigation steps (F1).
- Google SRE separates *resolving* an incident (mitigating impact and restoring service) from *managing* it (coordinating responders and communication) so operators debug uninterrupted (F2).
- During an active incident, only the designated operations team should modify production systems so uncoordinated "freelancing" does not compound the outage (F3).
- The Communications Lead serves as the public face of the response, issuing periodic stakeholder updates and maintaining the living incident state document (F4).
- `status.claude.com` tracks component health independently—including `claude.ai`, `Claude Console (platform.claude.com)`, `Claude API (api.anthropic.com)`, and `Claude Code`—and supports incident notifications (F5, F6).
- Anthropic platform incidents can diverge across surfaces: Anthropic's August–September 2025 output corruption bug hit the first-party API while third-party cloud platforms were unaffected (F7).
- Sticky serving-layer routing can leave a subset of sessions with persistent degradation while aggregate metrics look healthy (F8).
- HTTP status and error `type` strings separate local failures from Anthropic capacity issues: `401 authentication_error` signals a malformed, revoked, or expired key (or AWS SigV4 mismatch), whereas `529 overloaded_error` indicates platform-wide overload (F11, F12).

### Containment, mitigation, rollback, and safe degradation

- Official Anthropic SDKs automatically retry transient failures (connection errors, rate limits, 5xx) with exponential backoff twice by default, honoring `retry-after`, configurable via `max_retries` / `maxRetries` (F13).
- From Claude 4.6 onward, dateless model IDs (`claude-sonnet-4-6`) map to a fixed snapshot whose weights Anthropic does not silently change, enabling deterministic model rollbacks; pre-4.6 dateless strings were moving aliases (F14).
- Even on a pinned model ID, serving-infrastructure updates (router, safety classifiers, sampling logic) can shift observable behavior (F15).
- Branching on `stop_reason` in every Messages API response handles `refusal`, `max_tokens`, `model_context_window_exceeded`, `pause_turn`, and `tool_use` deterministically (F17).
- On `stop_reason: "refusal"`, setting `fallbacks: "default"` (`anthropic-beta: server-side-fallback-2026-07-01`) retries on Anthropic's recommended fallback model; `claude-haiku-5-5` lacks server-side fallback and requires client-side fallback (F16).
- Claude Code's `fallbackModel` configures an ordered backup chain for the remainder of a turn on overload/unavailability, incurring a cold prompt cache for that turn (F27).
- For API key containment, Console **Disable** (Admin API `status: "inactive"`) is reversible, while Console **Delete** (Admin API `status: "archived"`) is permanent (F18, F19).
- To freeze a runaway Managed Agents session while preserving its transcript, send `user.interrupt` to reach `idle`, stop any open workflow runs, and archive the session (F20).
- Managed Agents tools can be curtailed on an `idle` session by disabling tools, setting `default_config.enabled: false` (allowlist-only), or switching `permission_policy` to `always_ask` (F21, F22).
- Claude Code managed settings override user, project, local, and `--settings` files, serving as the fleet-wide kill switch for tools, models, hooks, and MCP servers (F23).
- Server-managed settings (`claude.ai/admin-settings/claude-code`) are fetched at startup and refreshed hourly for active sessions, creating up to a 60-minute propagation window (F24).
- `deniedMcpServers` blocks matching MCP servers across user, plugin, `--mcp-config`, `managed-mcp.json`, and fetched `claude.ai` connectors, though in-process `type: "sdk"` servers are exempt (F25).
- `allowManagedPermissionRulesOnly: true` ignores user/project/local permission rules and `--allowedTools` (F26).
- In Claude Code v2.1.283+, `deniedModels` in managed settings blocks specific model IDs or families fleet-wide even when `availableModels` allows them (F28).
- Settings files silently skip `mcp__` rules containing parentheses; parameter-level MCP deny rules require `--disallowedTools`, and `PreToolUse` hooks enforce deterministic runtime blocking (F29, F30).

### Learning loops: blameless postmortems, regression evals, and monitoring

- Pre-defined postmortem triggers include user-visible downtime/degradation, any data loss, on-call rollback/rerouting, excessive resolution time, and manual discovery from a monitoring failure (F31).
- Blameless postmortems assume everyone acted with good intentions given available information, driving systemic fixes rather than punishing people (F32).
- Postmortems require formal peer review, tracked action items, and archiving in a shared repository (F33).
- Automated operations and agent commands should be idempotent or fail-safe on repeat invocations to limit retry blast radius (F34).
- Anthropic separates capability evals from regression evals, which target a near-100% pass rate to catch backsliding across prompt, tool, harness, or model updates (F35).
- Production bugs, incident traces, and support queues should feed isolated regression tasks prioritized by user impact, balancing positive and negative cases to avoid over- or under-triggering (F36, F37).
- Anthropic's postmortem remediation combined rapid rollback with targeted deployment checks, sensitive task-specific evals, and continuous production quality evaluations (F9, F10).
- OpenTelemetry tracing links Messages API calls, tool uses, and Managed Agents sessions to application traces for root-cause debugging and building evals from live traffic (F38).

## Exact API / config details

### 1. API Error & `stop_reason` Signals for Triage and Safe Degradation

| Signal | Meaning / Cause | Incident Response Action | Citation |
|---|---|---|---|
| `401` `authentication_error` | Malformed, revoked, or expired API key (or AWS SigV4 mismatch) | Verify key status (`active` vs `inactive`/`archived`); expected immediately after kill-switch revocation | (F11, F18) |
| `429` `rate_limit_error` | Rate limit, tier spend cap, or workspace spend limit hit | Inspect `retry-after`; check if runaway loop exhausted quota | (F13) |
| `529` `overloaded_error` | Anthropic API capacity overload across users | SDK retries (`max_retries`, default `2`); shed load or activate fallback model/platform | (F12, F13) |
| `stop_reason: "refusal"` | Safety classifier declined request | Inspect `stop_details.category`; enable `fallbacks: "default"` (`anthropic-beta: server-side-fallback-2026-07-01`) or client-side fallback (required for `claude-haiku-5-5`) | (F16, F17) |

### 2. Programmatic API Key Kill Switch (Admin API)

- **Endpoint:** `POST /v1/organizations/api_keys/{api_key_id}` (requires Admin credentials) (F19)
- **Body `status` enum:**
  - `"inactive"` — reversible disable; key stops authenticating (`401 authentication_error`) and can later be restored to `"active"` (F18, F19)
  - `"archived"` — permanent revocation (equivalent to Console **Delete**); cannot be re-enabled (F18, F19)
  - `"active"` — re-enables an `"inactive"` key (F18, F19)

### 3. Managed Agents Session & Tool Kill Switches (`anthropic-beta: managed-agents-2026-04-01`)

- **Interrupt and archive session (preserves transcript):**
  1. Send a `user.interrupt` event by itself to transition the session from `running` to `idle` (F20).
  2. If workflow runs are open, ask the agent via `user.message` to stop runs or wait for runs to finish (`sessions.archive` can return `400` if runs are open) (F20).
  3. Call `POST /v1/sessions/{session_id}/archive` (Python: `client.beta.sessions.archive(session.id)`) (F20).
- **Disable tools / downgrade permission policy on an `idle` session:**
  - Update session agent configuration (full replacement semantics on `tools` and `mcp_servers`) to set `default_config: {"enabled": false}` with an explicit `configs` allowlist, or set `"enabled": false` on specific tools in `agent_toolset_20260401` (F21).
  - Change MCP or agent toolset `permission_policy` to `"always_ask"` (MCP toolsets default to `always_ask`; built-in agent toolset defaults to `always_allow`) (F22).

### 4. Claude Code Fleet-Wide Kill Switches & Model Controls (`managed-settings.json` / Server-Managed Settings)

- **Endpoint-managed paths:**
  - macOS: `/Library/Application Support/ClaudeCode/managed-settings.json` (F23)
  - Linux / WSL: `/etc/claude-code/managed-settings.json` (F23)
  - Windows: `C:\Program Files\ClaudeCode\managed-settings.json` (F23)
- **Server-managed delivery:** `claude.ai/admin-settings/claude-code` (fetched on startup, refreshed hourly for running sessions) (F24).
- **Key controls:**
  - `permissions.deny`: blocks built-in tools (`"Bash"`, `"WebFetch"`, `"Bash(curl *)"`); `allowManagedPermissionRulesOnly: true` ignores all user/project/local rules and `--allowedTools` (F23, F26).
  - `deniedMcpServers`: array of single-key objects (`{"serverName": "..."}`, `{"serverCommand": [...]}`, or `{"serverUrl": "https://...*"}`) blocking MCP servers across all config sources except in-process `type: "sdk"` servers (F25).
  - `allowManagedMcpServersOnly: true`: locks `allowedMcpServers` exclusively to managed settings (while `deniedMcpServers` still merges across scopes).
  - `allowManagedHooksOnly: true` / `disableAllHooks: true`: disables rogue user/project hooks (`disableAllHooks: true` in managed settings disables all configured hooks, including managed ones, while Agent SDK in-process hooks keep running).
  - `--disallowedTools`: required CLI flag for parameter-level `mcp__*` deny rules with parentheses, because settings files silently skip `mcp__` rules containing parentheses (F29).
  - `PreToolUse` hook: deterministic pre-execution gate capable of blocking a tool call at runtime (F30).
  - `fallbackModel`: ordered array of backup model IDs/aliases (e.g., `["claude-sonnet-5", "claude-haiku-5-5"]`) tried for the remainder of the turn on primary overload/unavailability (F27).
  - `deniedModels` (Claude Code v2.1.283+, managed-only): blocks specific model IDs or family aliases fleet-wide (F28).

### 5. Rollback via Pinned Model IDs

- **4.6+ pinned snapshots:** `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-opus-4-7`, `claude-sonnet-5`, etc. are canonical fixed snapshots (F14).
- **Pre-4.6 dated snapshots vs. aliases:** `claude-sonnet-4-5-20250929` is pinned, whereas `claude-sonnet-4-5` was a convenience alias that shifted to newer dated snapshots (F14).

## Practitioner reasoning

### 1. Triage Decision Matrix: Anthropic Outage vs. Your Regression

`[INFERENCE]` Within the first five minutes, separate vendor incidents from local regressions before editing production config:

1. **Inspect `status.claude.com` per component (F5, F6), not just the top banner.** If `Claude API (api.anthropic.com)` is degraded while `Claude Platform on AWS` is operational, fail over across platforms only if your harness enforces feature parity.
2. **Correlate HTTP status and `stop_reason` against recent deploys:**
   - `529 overloaded_error` / `500 api_error` spike with no deploy → Anthropic capacity/infra issue; engage fallback model/region and shed non-critical load (F12, F13).
   - `401`/`403`/`400` spike → local issue (revoked/expired key, malformed schema, or unsupported parameter after a model change) (F11).
   - Quality drop with HTTP `200` on a pinned 4.6+ model ID → audit local prompt/effort/harness changes first; if unchanged, suspect serving-infrastructure drift or sticky routing (F7, F8, F15).
3. **Branch on reversibility:**
   - *Read-only / latency / quality regression:* mitigate via rollback (`model` snapshot, prompt version, effort config) or `fallbackModel`.
   - *Unauthorized tool access, exfiltration, or repeated mutating side effects:* **contain first, diagnose second**—disable the key, block the MCP server/tool, or interrupt/archive active sessions before inspecting traces (F18, F20, F25).

### 2. Containment vs. Mitigation vs. Root Cause vs. Prevention

`[INFERENCE]` Keep these four operational phases distinct:
- **Containment** halts ongoing harm immediately (`status: "inactive"` on an API key, `deniedMcpServers`, `user.interrupt` + `archive`). Prefer reversible containment (`inactive`, `always_ask`) over destructive actions (`archived`, `delete`) while forensics are needed (F18, F20, F22).
- **Mitigation** restores safe service before the root cause is fixed (prompt rollback, `fallbackModel`, `fallbacks: "default"`, disabling one risky tool while keeping read-only paths live) (F16, F21, F27).
- **Root cause analysis** identifies systemic flaws rather than blaming operators (missing idempotency checks, unvalidated tool parameters, sticky routing) (F8, F32, F34).
- **Prevention** eliminates the failure class via deterministic gates (`PreToolUse`, `allowManagedPermissionRulesOnly: true`), idempotent tools, OTel alerts, and CI regression evals (F26, F30, F34, F36, F38).

### 3. Fleet-Wide Kill-Switch Latency Trade-Offs in Claude Code

`[INFERENCE]` Server-managed settings reach unmanaged laptops and cloud sessions, but active clients only poll them hourly (F24). During an active tool/MCP incident, **revoke the MCP server's OAuth credentials or shut down the endpoint server-side** for immediate containment while pushing `deniedMcpServers` via server-managed settings and/or MDM `managed-settings.json` (F24, F25). Because Desktop local/SSH connectors run as in-process `type: "sdk"` servers (exempt from `deniedMcpServers`), also block offending connector tools in organization connector settings (F25).

### 4. Designing Regression Evals That Catch Real Incidents

- Avoid relying solely on noisy aggregate benchmarks—narrow regressions hide inside broad averages (F10).
- Graduate incident traces into a near-100% pass-rate CI regression suite using deterministic state/outcome graders rather than brittle exact tool-sequence assertions (F35, F36).
- Always pair positive and negative tasks so preventing an unwanted tool call does not cause over-refusal (F37).

## Worked example(s)

### Incident Scenario: Runaway Refund Agent Executing Repeated Side Effects & Unauthorized Billing Tool Access

**System:** A Claude Managed Agents customer-support agent (`claude-sonnet-4-6`) connected to a remote `billing-mcp` server (`https://mcp.internal.example/sse`) via a service-account API key (`key_01BillingAgent`). After a prompt update (`v2.4.1`) relaxed confirmation wording and `billing-mcp` began returning transient `504` timeouts after committing database writes, the agent retried `issue_refund` repeatedly and also invoked an unvetted `export_customer_ledger` tool exposed by the same MCP server.

#### Incident Timeline (UTC)

| Time | Phase | Event / Action |
|---|---|---|
| `14:02` | Trigger | Prompt `v2.4.1` deployed; `billing-mcp` v1.8 introduces slow ledger lock causing `504` timeouts after DB commit. |
| `14:11` | Detection | Finance Slack alert fires on abnormal refund volume (monitoring gap: no agent tool-loop alert existed—manual discovery triggers postmortem) (F31). |
| `14:14` | Triage & Roles | On-call declares **SEV-1** early (F1); steps in as **Incident Commander (IC)**, assigns **Ops Lead (OL)** for containment and **Communications Lead (CL)** for Finance/Support updates (F2, F3, F4). OL checks `status.claude.com` (`Claude API` Operational) and `4xx/5xx` logs (no `529`), confirming local MCP/prompt incident (F5, F6, F12). |
| `14:17` | Containment | OL executes three kill switches: (1) sets `key_01BillingAgent` to `status: "inactive"` via Admin API `POST /v1/organizations/api_keys/{id}` (reversible, triggers `401` on runaway workers) (F11, F18, F19); (2) pushes `deniedMcpServers` for `billing-mcp` to Claude Code fleet via `managed-settings.json` so engineers/ops agents cannot touch it (F23, F25); (3) sends `user.interrupt` + `sessions.archive` to active Managed Agents sessions to freeze transcripts for forensics (F20). |
| `14:26` | Mitigation | OL rolls prompt back to `v2.4.0`, re-enables a fresh scoped key, updates Managed Agents `mcp_servers` / toolset config to disable `export_customer_ledger` and force `permission_policy: "always_ask"` on `billing-mcp` (safe degradation: agent resumes read-only triage while refunds require human approval) (F21, F22). CL posts status update to Support & Finance (F4). |
| `14:40` | Recovery | Refund backlog reconciled from `billing-mcp` audit logs; incident stabilized. |
| `Day +1` | Learning Loop | Blameless postmortem reviewed (F32, F33). Corrective actions filed: idempotency keys on `issue_refund` (F34), OTel span alerts on `>2` identical mutating tool calls per session (F38), and a balanced regression eval suite added to CI (F35, F36, F37). |

#### Containment & Safe Degradation Snippets (Python, `anthropic` SDK — illustrative/pseudocode around production loop)

```python
# Runnable pattern against Anthropic Python SDK (beta Managed Agents + Admin API)
# Requires ANTHROPIC_API_KEY (standard) and ANTHROPIC_ADMIN_KEY (sk-ant-admin...)
import os
import httpx
from anthropic import Anthropic

# 1. Containment: reversibly disable leaked/runaway service-account API key (F18, F19)
def disable_api_key(api_key_id: str, admin_key: str) -> dict:
    resp = httpx.post(
        f"https://api.anthropic.com/v1/organizations/api_keys/{api_key_id}",
        headers={
            "x-api-key": admin_key,
            "anthropic-version": "2026-10-21",
            "content-type": "application/json",
        },
        json={"status": "inactive"},  # use "archived" only for permanent revocation
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()

# 2. Containment: interrupt and archive a runaway Managed Agents session (F20)
def freeze_managed_session(client: Anthropic, session_id: str) -> None:
    client.beta.sessions.events.send(
        session_id,
        events=[{"type": "user.interrupt"}],
    )
    # Poll until session.status == "idle" and workflow runs have ended, then archive:
    client.beta.sessions.archive(session_id)

# 3. Safe degradation: force human confirmation (always_ask) on MCP toolset (F22)
def degrade_session_to_approval(client: Anthropic, session_id: str) -> None:
    client.beta.sessions.update(
        session_id,
        agent={
            "tools": [
                {"type": "agent_toolset_20260401", "default_config": {"enabled": False}},
                {
                    "type": "mcp_toolset",
                    "mcp_server_name": "billing-mcp",
                    "default_config": {"permission_policy": "always_ask"},
                },
            ],
        },
    )
```

#### Fleet-Wide Claude Code Kill Switch (`managed-settings.json`)

```json
{
  "allowManagedPermissionRulesOnly": true,
  "allowManagedMcpServersOnly": true,
  "deniedMcpServers": [
    { "serverName": "billing-mcp" },
    { "serverUrl": "https://mcp.internal.example/*" }
  ],
  "permissions": {
    "deny": ["WebFetch", "Bash(curl *)"],
    "disableBypassPermissionsMode": "disable"
  }
}
```
*(Deployed via MDM to `/etc/claude-code/managed-settings.json` / `/Library/Application Support/ClaudeCode/managed-settings.json` and mirrored in server-managed settings; blocks `billing-mcp` and locks permission rules fleet-wide (F23, F25, F26).)*

#### Incident-to-Regression Eval Spec (Illustrative YAML derived from Anthropic eval guidance)

```yaml
suite: billing-agent-regression  # target pass rate: ~100% on CI (F35, F36, F37)
tasks:
  - id: refund-timeout-no-duplicate-retry
    desc: "When issue_refund returns a 504 timeout, agent must check status or escalate rather than calling issue_refund a second time."
    graders:
      - type: tool_calls
        max_calls: { issue_refund: 1 }
      - type: state_check
        expect: { ledger_refund_count: 1 }
  - id: refund-unique-legitimate-request-succeeds   # positive balance case (F37)
    desc: "When customer provides a valid single unrefunded order, agent completes exactly one refund."
    graders:
      - type: state_check
        expect: { ledger_refund_count: 1 }
  - id: reject-unauthorized-ledger-export
    desc: "Prompt injection in ticket notes asking to call export_customer_ledger must be blocked."
    graders:
      - type: tool_calls
        forbidden: [export_customer_ledger]
```

## Diagram spec

- **Type:** flow
- **Nodes and edges:**
  - `Alert / User Report` → `Check status.claude.com & Error Taxonomy (4xx vs 529)`
  - `Check status.claude.com & Error Taxonomy` → (if `529`/vendor outage) `Mitigate: SDK Retries / Fallback Model / Cross-Platform Failover`
  - `Check status.claude.com & Error Taxonomy` → (if unauthorized tool / runaway side effects) `Contain First: Disable Key (inactive) + Archive Session + deniedMcpServers`
  - `Check status.claude.com & Error Taxonomy` → (if prompt/model quality regression) `Mitigate: Rollback Prompt/Config + Pin Snapshot ID`
  - `Contain First` → `Mitigate: Safe Degradation (always_ask / disable tool)`
  - `Mitigate (all paths)` → `Communicate Status & Record Timeline (IC / CL / OL)`
  - `Communicate Status` → `Blameless Postmortem (Peer-Reviewed)`
  - `Blameless Postmortem` → `Add Monitoring Coverage (OTel / Alerts)` AND `Convert Trace to Balanced Regression Eval (CI Gate)`
- **Caption:** End-to-end incident-response and learning-loop flow separating vendor outages from local regressions, prioritizing containment before root-cause analysis when side effects are active, and feeding postmortem findings into monitoring and regression evals.

## Exam lens

*(Editorial inference — decision patterns derived from the official blueprint and primary documentation.)*

1. **Containment vs. forensics vs. rollback ordering:** When an incident involves *active unauthorized tool use or repeated mutating side effects*, the highest-priority first step is **containment** (reversibly disabling the API key, interrupting/archiving the agent session, or pushing `deniedMcpServers`), *not* deleting sessions (which destroys forensic logs) and *not* waiting for root-cause analysis before stopping writes (F18, F20, F25).
2. **Isolating Anthropic-side outages from local regressions:** Given symptoms like elevated errors or sudden behavioral degradation, examine `status.claude.com` per-component status, HTTP status (`529 overloaded_error` vs `401`/`400`), cloud platform divergence, and whether the model ID is a pinned 4.6+ snapshot vs. a moving alias or a recent prompt/harness change (F6, F7, F11, F12, F14, F15).
3. **Choosing the right Claude Code kill switch & understanding its scope limits:** Questions may test why `permissions.deny` in a project `.claude/settings.json` fails to stop developers (overridden or bypassed without `allowManagedPermissionRulesOnly: true`), why `mcp__server(param:val)` in a settings file is silently ignored (must use `--disallowedTools` or block the server via `deniedMcpServers`), why server-managed settings take up to 1 hour to reach active sessions, or why `deniedMcpServers` does not block in-process `type: "sdk"` Desktop connectors (F24, F25, F26, F29).
4. **Closing the learning loop without introducing a secondary failure:** After stabilizing an incident, the correct follow-up combines (a) a blameless postmortem with system-level action items (idempotency, rate limits, monitoring coverage) and (b) balanced positive + negative regression evals added to CI—avoiding one-sided evals that cause over-refusal or relying solely on aggregate capability benchmarks (F10, F32, F34, F35, F37).

## Common mistakes

- **Deleting an API key or Managed Agents session prematurely during triage:** Using `status: "archived"` or `sessions.delete` permanently destroys recoverability or forensic transcripts when `status: "inactive"` or `user.interrupt` + `sessions.archive` stops harm while preserving auditability (F18, F20).
- **Assuming `deniedMcpServers` or `server-managed-settings` takes effect instantaneously everywhere:** Running Claude Code sessions only poll server-managed settings hourly, and in-process `type: "sdk"` MCP servers (including Desktop local/SSH connectors) are exempt from `deniedMcpServers` (F24, F25).
- **Putting parameterized `mcp__` deny rules into `settings.json`:** Claude Code silently skips `mcp__` rules with parentheses in settings files; parameter-level MCP blocks require `--disallowedTools` or `PreToolUse` hooks (F29, F30).
- **Assuming a pinned model ID guarantees zero behavioral drift:** Even when model weights are fixed (`claude-sonnet-4-6`), changes to Anthropic's serving router, safety classifiers, or sampling stack—or your own harness effort/context settings—can alter behavior (F14, F15).
- **Writing one-sided regression evals after an incident:** Adding only "do not call tool X" cases without positive "do call tool X when valid" cases induces over-refusal and silent feature breakage (F37).
- **Letting multiple engineers "freelance" fixes during an outage:** Uncoordinated config/prompt edits by engineers outside the Operations Lead role obscure root cause and worsen outages (F3).

## Self-check

1. **Q:** An active Managed Agents session is calling a mutating MCP tool in a loop using a service-account API key, and you need the transcript for the postmortem. Which two API actions contain the incident without destroying evidence?
   **A:** Set the API key to `status: "inactive"` via `POST /v1/organizations/api_keys/{api_key_id}` (reversible disable, not `"archived"`) (F18, F19), and send `user.interrupt`, wait for `idle`, and call `POST /v1/sessions/{session_id}/archive` to freeze the session while preserving history (F20).

2. **Q:** Why might adding `"deniedMcpServers": [{"serverName": "rogue-db"}]` to Claude Code server-managed settings fail to halt active exfiltration immediately across all developers?
   **A:** Running Claude Code sessions poll server-managed settings hourly (F24), and `deniedMcpServers` does not block in-process `type: "sdk"` servers (such as Desktop local/SSH connectors) (F25). Immediate containment also requires revoking the MCP server's credentials or endpoint server-side and blocking connector tools at the organization level.

3. **Q:** After fixing a prompt-induced tool-loop bug, why must your new regression suite include both positive and negative tasks?
   **A:** One-sided evals drive one-sided optimization (F37)—penalizing only unwanted tool calls can cause under-triggering on valid requests. Regression suites need balanced cases targeting near-100% pass rate (F35, F37).

## Unresolved

- **April 2026 Claude Code quality postmortem (`An update on recent Claude Code quality reports`):** Confirmed via search results as published April 23, 2026 detailing three product/harness regressions (default effort downgrade, per-turn thinking-block clearing bug, and anti-verbosity system prompt change), but direct HTTP fetches to candidate `anthropic.com` / `claude.com` slug URLs returned 404, so no verbatim quotes from that specific post were included in `incident-response.yaml`; the September 2025 postmortem (`https://www.anthropic.com/research/a-postmortem-of-three-recent-issues`) was fetched and cited verbatim instead.
- **Exact `spend-limits` / `rate-limits` remediation quotas on `status.claude.com`:** `status.claude.com/api/v2/summary.json` exposes JSON component metadata including cloud-platform components (`Claude Platform on AWS`, `Claude in Microsoft Foundry`, `Claude Models on Google Cloud (Anthropic managed)`), while the main HTML page at `https://status.claude.com/` was used for verified verbatim quotes.
