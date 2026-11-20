# 8.3 Unattended and Event-Driven Agent Operations

Applying unattended-operation patterns to goal- or schedule-driven engineering tasks, including agents running toward goals, on schedules, or as event-driven responders such as CI/CD incident first response, with checkpointing, notification, and escalation design.

## Scope map

- Unattended and goal-driven engineering → Core facts; Exact API / config details; Practitioner reasoning.
- Agents running toward goals or on schedules → Exact API / config details; Exam lens.
- Event-driven responders and CI/CD first response → Exact API / config details; Worked example.
- Checkpointing, notification, and escalation → Core facts; Practitioner reasoning; Worked example.

## Core facts

- `claude -p` exposes the Claude Code agent loop non-interactively; the Agent SDK also has Python and TypeScript interfaces. (F1)
- Print mode can cap agentic turns and estimated API spend. The default turn count is unlimited, estimated spend can overshoot, and a resumed run's cap does not count restored earlier spend. (F4, F5, F33)
- Tool permission modes and rules determine what Claude may do. An unattended run can deny unresolved approval requests and continue; a denial is not necessarily a failed run. (F6, F7)
- `/goal` repeatedly advances work toward a completion condition evaluated by a separate model. A model verdict is not a deterministic test result. (F15, F16)
- Session scheduling is different from independent cloud tasks: session tasks have resume exceptions and recurring tasks expire after seven days; cloud tasks clone the repository for each run. (F17, F18, F22)
- The GitHub Action responds to GitHub events; a cloud scheduled task can be invoked with a bearer-authenticated API request carrying explicitly untrusted context. (F19, F20, F23)
- SDK session history persists conversation, not filesystem state. File rewind and Managed Agents sandbox checkpointing are distinct mechanisms. (F10, F11, F12, F13)
- Notification hooks can forward notifications. Stop signals a main-agent response ended, not necessarily a successful job; interruption bypasses Stop, and API errors use StopFailure. (F26, F27)

## Exact API / config details

**CLI and SDK.** `claude -p 'prompt'` runs non-interactively and can accept piped input. `--output-format json` returns a result and metadata; with `--json-schema`, check for `structured_output`, which can be absent. `--output-format stream-json --verbose --include-partial-messages` streams newline-delimited event objects, ending with a `result` message. Persist session metadata for correlation. (F1, F2, F3)

`--max-turns 8` limits agentic turns in print mode. `--max-budget-usd 2.00` limits estimated API spend for that invocation, including subagents, with possible overshoot. `--permission-mode` accepts `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`, and `manual` as an alias of `default`. `--allowedTools` preapproves specified tool calls. `--permission-prompts none` denies unresolved prompts; it requires Claude Code v2.1.259 or later. These controls do not replace external credential and network restrictions. (F4, F5, F6, F7, F25)

`--continue` selects the most recent conversation in the current directory; `--resume <session-id>` selects an identified local conversation. Persist the session files and workspace independently across ephemeral runners. For SDK file checkpointing, set Python `ClaudeAgentOptions(enable_file_checkpointing=True)` on the original run, capture session ID and turn-start user-message UUID, then resume with checkpointing enabled and call `ClaudeSDKClient.rewind_files(checkpoint_id)` while connected. The documented tools are `Write`, `Edit`, and `NotebookEdit`; Bash modifications and subagent edits have exclusions. Rewinding files does not rewind the conversation or external effects. (F10, F11, F12)

In Claude Managed Agents, send a `user.message` to resume an idle session; an idle checkpoint preserves sandbox files and installed packages. `idle` can coexist with an open workflow run, so inspect workflow state too. This is separate from the SDK's local session persistence. (F13, F14)

**Goals and schedules.** Example: `claude -p '/goal All migrations compile and the test suite passes' --output-format stream-json --verbose`. `/goal` uses a separate model to evaluate each turn; it clears when met, judged impossible, or on an error requiring intervention. `/goal clear` clears the session goal. `/loop 5m check the deploy` repeats on a session schedule; session tasks restore on resume subject to limitations and expiry. Cloud scheduled tasks can use schedule, GitHub or API triggers to start independent sessions. GitHub trigger categories documented are pull requests, releases and issues; do not assume native CI check-failure events. (F15, F16, F17, F18, F19, F21, F22)

For an API-triggered cloud task, configure its trigger on the web and store its task-scoped token as a secret. POST to its `/fire` URL with `Authorization: Bearer …`, `anthropic-version: 2023-06-01`, `anthropic-beta: experimental-cc-routine-2026-04-01`, and JSON `{"text":"…"}`. The response provides a session URL. The saved prompt must explicitly reference the `<routine-fire-payload>` block to use the supplied alert; treat that text as data rather than instructions. (F19, F20)

**GitHub Action.** `anthropics/claude-code-action@v1` takes `prompt`, `anthropic_api_key`, `github_token`, `settings`, and `claude_args`. A `prompt` invokes automation mode; `claude_args` passes CLI options, including `--max-turns` and `--allowedTools`. The official setup installs the Claude GitHub App; its workflow examples grant `id-token: write`. A plain-text prompt needs explicit tool permissions for shell or GitHub API use. Keep GitHub permissions minimal and review changes. (F23, F24, F25, F32)

**Hooks and termination.** Notification input includes `session_id`, `transcript_path`, `cwd`, `message`, optional `title`, and `notification_type`; matchers include `permission_prompt` and `idle_prompt`. Notification hooks forward events but do not block them. Stop input includes `stop_hook_active`, `last_assistant_message`, `background_tasks`, and `session_crons`: check continuation state to avoid loops. Stop is neither a process-exit hook nor a reliable success event. (F26, F27, F35)

SIGTERM in print mode exits 143, leaves the turn unfinished, kills active Bash process trees, and runs `SessionEnd` hooks. Use SIGINT or SDK `interrupt()` to end the turn first. Remote MCP tasks can continue independently. For a Managed Agents scheduled run, stop new scheduled starts by pausing the deployment; interrupt the session, stop any open workflow runs, wait for idle, and archive or delete as appropriate. Deletion permanently removes session events and sandbox, so first retain outputs. (F28, F29, F30, F31)

## Practitioner reasoning

- [INFERENCE] Give every unattended run a precise goal, independent completion test, explicit scope, wall-clock deadline, estimated-cost cap, and a turn limit. Treat exhaustion, denied permissions, missing evidence, failed verification, and timeout as distinct outcomes; escalate rather than report success.
- [INFERENCE] Require human review for merge, production deploy, or irreversible remediation unless a specific low-risk action was authorized. First response can collect evidence, propose hypotheses, and name the next diagnostic action without claiming a verified root cause.
- [INFERENCE] Deduplicate by repository, workflow run ID and attempt; bound concurrency and record source SHA, event, session ID, and artifacts. Verify the checkout is the failed revision: a fresh default-branch clone may inspect different code. Check for remote tasks and external side effects before retrying.
- [INFERENCE] Treat failure logs, repository content, PR text, and trigger payloads as untrusted. Apply command, credential, network, and destination restrictions outside the prompt. A non-bare print run can load repository hooks and MCP settings without a workspace-trust prompt; use trusted configuration or bare mode, recognizing bare mode also disables hooks. (F8, F9, F20)
- [INFERENCE] Persist a checkpoint manifest containing incident key, source SHA, session ID, workspace snapshot or commit, phase, evidence, and cumulative spend. A session ID alone cannot restore the workspace or undo an external API action. Track remaining overall budget outside the CLI because its resumed-run cap excludes restored spend. (F10, F33)
- [INFERENCE] Route hook notifications through a controlled relay with deduplication, rate limits and correlation IDs. Independently watch job status and expected artifacts: hooks can be skipped by crashes or interruption, and a response can finish with work still pending. Escalate critical impact, ambiguity, missing access, repeated retries, or missed deadline to an identified on-call owner. (F26, F27, F35)
- [INFERENCE] On cancellation, stop new triggers, interrupt, cancel remote work where supported, collect logs and checkpoints, revoke temporary credentials, and remove ephemeral resources. Verify external state because interruption and cleanup do not roll back effects. (F28, F29, F30, F31)

## Worked example(s)

**CI incident first response.** This is a GitHub Actions workflow, runnable after installing the Claude GitHub App and setting `ANTHROPIC_API_KEY`; the action inputs and CLI flags follow the cited documentation. Replace `CI` with the upstream workflow's name. It writes a diagnostic report to the job log and does not fetch the failed logs or post a comment automatically. (F23, F24, F25, F32)

```yaml
name: CI failure first response
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
jobs:
  investigate:
    if: github.event.workflow_run.conclusion == 'failure'
    runs-on: ubuntu-latest
    timeout-minutes: 12
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.workflow_run.head_sha }}
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: >-
            Investigate likely causes of the failed CI run using the checked-out
            source. Report evidence, uncertainty, and next diagnostic steps.
            Do not modify files or perform remediation.
          claude_args: >-
            --max-turns 8 --max-budget-usd 2.00
            --permission-mode dontAsk --allowedTools "Read,Glob,Grep"
```

[INFERENCE] The $2 estimated spend cap, eight turns, and 12-minute timeout bound different resources. A production wrapper should fetch and sanitize logs with narrowly scoped credentials, persist the run URL and source SHA, validate the result, and notify on-call on timeout, denial, missing logs, or failed agent execution. Filter and authenticate upstream events, and review fork-code and secret exposure. Without failure evidence this workflow cannot independently confirm a cause.

**Recovery scenario.** [INFERENCE] A migration has completed phase 2 of 4 when its runner dies. Restore the saved workspace at its recorded snapshot, retrieve the persisted SDK session by ID, inspect whether phase 2's external operation actually completed, then resume with current evidence. If undoing edits, use the captured checkpoint only within its documented scope; otherwise restore from version control or backups. Apply the remaining overall spend budget in the orchestrator. (F10, F11, F12, F33)

## Diagram spec

Flow: CI failure → authenticate and deduplicate event → isolated runner and sanitized evidence → bounded Claude diagnostic → independent evidence and result check → report to on-call; denial, missing evidence, timeout, ambiguous result, or error → escalation. Persist run ID, session ID, workspace state and artifacts. Caption: An unattended responder depends on deterministic triggering, controls, evidence retention and escalation.

## Exam lens

- **Editorial inference:** Select a goal loop for a completion condition, a schedule for periodic work, or an event trigger for first response; distinguish session-scoped from durable scheduling.
- **Editorial inference:** Distinguish conversation history, supported file rewind, managed sandbox checkpoints, and irreversible external effects when recovering a run.
- **Editorial inference:** Prefer bounded least-privilege diagnostics with visible denials, independent verification, and human escalation when incident scope is uncertain.

## Common mistakes

- Treating a zero exit or Stop hook as proof tests passed, all background work completed, or the incident was fixed. (F27, F29)
- Treating `--allowedTools` or a prompt as a complete security boundary while retaining write credentials, untrusted hooks, or MCP connectors. (F8, F32, F34)
- Assuming `--resume` restores files, reverses external operations, or preserves a cross-run budget. (F10, F33)
- Assuming an unanswered approval always blocks a headless run; a denied request may allow an incomplete run to continue. (F7)

## Self-check

1. Why isn't `/goal` completion alone proof tests passed? **Answer:** A separate model evaluates the goal; independently run and inspect tests, with turn, time and cost limits. (F15)
2. A runner dies after SDK file edits and a remote MCP job starts. What must be recovered? **Answer:** Restore conversation and workspace separately, inspect the remote job and side effects, then decide whether to resume; rewind coverage is limited. (F10, F11, F29)
3. A headless run denies a permission but produces a report. What next? **Answer:** Inspect denial and evidence status, mark missing investigation incomplete, and escalate. (F7)

## Unresolved

- The quote verifier's direct HTTP fetches are blocked in this environment. Documentation was read through the web tool; the requested verifier reported 2 verified, 0 not-found and 33 fetch-failed citations. Rerun with network access before publishing.
- The example has not been integration-tested against a particular repository, action release, GitHub App installation and secrets. It needs evidence retrieval and an alerting integration for production.
