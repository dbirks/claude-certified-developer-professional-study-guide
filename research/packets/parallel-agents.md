# 8.1 Parallel Agent Orchestration for Engineering Work

> Evaluating parallel fan-out patterns for large engineering tasks, including parallel agents on isolated worktrees, task decomposition, and merge and conflict strategy, and diagnosing fleet-level failure modes from fleet telemetry.

## Scope map

| Sub-objective in official text | Packet section(s) |
|---|---|
| Evaluating parallel fan-out patterns for large engineering tasks | Core facts, Exact API / config details, Practitioner reasoning, Worked example(s), Exam lens |
| Parallel agents on isolated worktrees | Core facts, Exact API / config details, Practitioner reasoning, Worked example(s), Diagram spec |
| Task decomposition | Core facts, Practitioner reasoning, Worked example(s), Exam lens, Common mistakes |
| Merge and conflict strategy | Core facts, Practitioner reasoning, Worked example(s), Diagram spec, Common mistakes |
| Diagnosing fleet-level failure modes from fleet telemetry | Core facts, Exact API / config details, Practitioner reasoning (fleet failure-mode table), Worked example(s), Exam lens |

## Core facts

- **Five parallel execution models:** Claude Code provides *subagents* (in-session hub-and-spoke workers), *agent view* (`claude agents` / `claude --bg` background sessions), *agent teams* (experimental interactive lead + peer teammates with shared task list and mailboxes), *projects* (cloud/Remote Control threads), and *dynamic workflows* (JavaScript `parallel()` / `pipeline()` fan-outs) (F1, F12, F13, F17).
- **Supporting primitives (`/batch`, worktrees, cross-session messaging):** Git worktrees isolate filesystem edits per session or subagent; cross-session messaging passes plain text between sessions; `/batch` decomposes a change into 5–30 independent units and spawns one worktree-isolated background subagent per unit after plan approval (F1, F11, F12).
- **Worktree isolation & `-p` cleanup:** `claude --worktree <name>` (`-w`) creates `.claude/worktrees/<name>/` on branch `worktree-<name>` (requiring at least one commit) (F2, F3). Non-interactive `-p --worktree` skips the trust prompt and exit cleanup prompt, leaving worktrees and git locks until manually unlocked/removed or reclaimed by a stale-lock sweep (F3, F8).
- **Subagent & background session isolation:** `isolation: worktree` subagents get temporary worktrees auto-removed when clean and kept if changes remain (F9). `claude agents` / `claude --bg` sessions move into `.claude/worktrees/` before editing (unless `worktree.bgIsolation: "none"`) and commit, push their branch, and open a draft PR without pushing to `main`/`master`, force-pushing, or merging (F10).
- **Worktree isolation boundaries:** Four checks enforce worktree isolation (file edits, command working directory, git redirects, command shape), though non-git shell writes (`cp` or redirects) rely on permissions/sandboxing (F6). Worktrees share `.git`, project plugins, `.claude/settings.local.json` approvals, and fallback untracked `.claude/skills`, `agents`, and `commands` (F7).
- **Agent teams vs. worktrees:** Agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, interactive-only, ignored in `-p`/SDK) coordinate via a file-locked task list and JSON mailboxes (F13), but do **not** isolate teammates in worktrees—file ownership must be partitioned (F12, F14).
- **Deterministic gates:** `TaskCreated`, `TaskCompleted`, and `TeammateIdle` hooks exit `2` to reject premature completion/idle and return feedback (F16); `CLAUDE.md` emphasis is non-deterministic and cannot replace hooks or branch protection (F19).
- **Dynamic workflows:** Hold loop state in plain JS outside context; default `16` concurrent agents (`1–256` configurable), `4,096` items/call, `1,000` agents/run, and `5,000 ms` prefix staggering for prompt caching (F17).
- **Task decomposition (*Building a C compiler*):** Sixteen parallel agents built a 100k-line Rust compiler (~2,000 sessions, ~$20,000, 2B input / 140M output tokens) using a bare git repo and `current_tasks/` lockfiles (F20). Pointing all 16 at compiling the Linux kernel caused same-bug overwrites; using GCC as a compiler oracle on random file subsets plus delta debugging restored parallelism (F21).
- **Harness ergonomics & multi-session continuity:** Avoid context pollution (concise output, single-line `ERROR` entries, precomputed summaries), mitigate time blindness with `--fast` 1%–10% per-agent subsampling, enforce CI gates, and specialize roles (deduplication, performance, code quality, docs) (F22). Initializer (`init.sh`, `claude-progress.txt`, initial commit) + incremental coding agents prevent one-shotting or early victory (F23).
- **Token economics & when NOT to parallelize:** Token spend scales linearly with active context windows (F18). Start teams at 3–5 teammates (5–6 tasks each) (F14), use Sonnet/Haiku for routine workers, and shut down idle teammates promptly (F18). Avoid parallelizing sequential, tightly coupled, or same-file work—fresh subagents also incur cold-start context gathering (F14, F19).
- **Fleet OTel & Analytics:** `CLAUDE_CODE_ENABLE_TELEMETRY=1` (ignored in repo `.claude/settings.json`) exports 8 metrics, events, and optional nested spans (F24, F29). Filter `session.count` on `start_type != "agents_view"` (F25); tag fleets with `vcs.*` and `host.name`/`host.id` and trace via `agent_id`/`parent_agent_id`/`workflow.run_id` (F26, F29). `api_error` fires only after retry exhaustion (`attempt` up to `11`); a later `api_request` in the same `session.id` separates recovery from stalls (F27). Refusals emit `api_refusal`, not `api_error` (F28). Team/Enterprise Analytics (`claude.ai/analytics/claude-code`) adds GitHub PR attribution (21d before to 2d after merge, >20% rewrites excluded, off under ZDR), while API Console shows usage/spend only (F30).

## Exact API / config details

### Worktree CLI flags, files, and settings

- **CLI flags:**
  - `claude --worktree <name>` / `claude -w <name>` — creates `.claude/worktrees/<name>/` on branch `worktree-<name>` (auto-generated name if omitted) (F3).
  - `claude -w <name> --tmux` (`--tmux=classic` for non-iTerm2 tmux) — creates a tmux session for the worktree (F3).
  - `claude --worktree "#1234"` (or GitHub PR / GitLab MR URL) — fetches `pull/<number>/head` or `merge-requests/<number>/head` from `origin` into `.claude/worktrees/pr-<number>` (F4).
  - `claude -p --worktree <name>` — skips workspace trust dialog and exit cleanup prompt; leaves worktrees and git locks on disk until `git worktree unlock <path>` + `git worktree remove <path>` or a later stale-lock sweep (F3, F8).
  - `claude agents` / `claude --bg` — dispatches/monitors background sessions, isolating edits in `.claude/worktrees/` unless `worktree.bgIsolation` is `"none"` (F10).
- **In-session tools & skills:** `EnterWorktree` / `ExitWorktree` (disabled when `permissions.blockWritesOutsideWorkingDirectories` is on); `/batch <instruction>` (5–30 units, worktree-isolated background subagents) (F11).
- **Settings & repo files:**
  - `.worktreeinclude` (project root, `.gitignore` syntax): copies gitignored files (e.g., `.env`, `.env.local`) into new git worktrees; `WorktreeCreate` hooks must copy files manually (F5).
  - `worktree.baseRef`: `"fresh"` (default — remote default branch, fetched up to 5 s if >24 h stale) or `"head"` (local `HEAD`, for subagents building on unpushed commits) (F4).
  - `worktree.bgIsolation`: `"none"` disables automatic worktree isolation for `claude --bg` / `claude agents` (F10).
  - Subagent frontmatter: `isolation: worktree` (in `.claude/agents/<name>.md` or `Agent` call) (F9).
  - Sandbox caveat: under filesystem sandboxing, `git commit` works from the worktree root but fails with `index.lock` errors if `claude` starts in a subdirectory (F7).
  - Non-git VCS hooks: `WorktreeCreate` (prints directory path on stdout) and `WorktreeRemove` in `settings.json` (F5, F11).

### Agent Teams & Dynamic Workflows config

- **Agent Teams (experimental):**
  - Enable via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in shell or `settings.json` `env` (ignored in `-p` and Agent SDK) (F13).
  - Display mode: `--teammate-mode` (`in-process` default, `auto`, `tmux`, `iterm2`) (F15).
  - State paths: `~/.claude/teams/{team-name}/config.json` (removed at session end), `~/.claude/tasks/{team-name}/` (file-locked, kept until `cleanupPeriodDays`), `~/.claude/teams/{team-name}/inboxes/{agent-name}.json` (F13).
  - Hooks: `TeammateIdle`, `TaskCreated`, `TaskCompleted` — exit code `2` blocks the transition and feeds back errors (F16).
  - Limits: 1 team/session, no nested teams, no `/resume` or `/rewind` for in-process teammates, no `background: true` subagents inside in-process teammates (F15).
- **Dynamic Workflows:**
  - `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`: `1`–`256` (default `16`, capped by available CPUs; v2.1.269+) (F17).
  - `CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS`: default `5000` ms hold so sibling fan-outs hit the first worker's prompt cache (`0` disables) (F17).
  - Caps: `4,096` items per `parallel()`/`pipeline()` call; `1,000` agents/run; advisory `Large workflow` warning at `> 25` agents or `> 1.5M` projected tokens (F17).

### Fleet OpenTelemetry & Analytics configuration

- **Core OTel env vars (must be in managed settings, `~/.claude/settings.json`, or launch shell — ignored in repo `.claude/settings.json`):** (F24)
  - `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER` (`otlp`, `prometheus`, `console`, `none`), `OTEL_LOGS_EXPORTER` (`otlp`, `console`, `none`).
  - `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` + `OTEL_TRACES_EXPORTER=otlp` (nests subagent `claude_code.llm_request`/`claude_code.tool` spans under parent `claude_code.tool`; propagates W3C `TRACEPARENT` in `-p`/SDK and Bash subprocesses) (F29).
  - Cardinality & fleet identity: `OTEL_METRICS_INCLUDE_SESSION_ID` (`true`), `OTEL_METRICS_INCLUDE_REPOSITORY` (`true` -> `vcs.*`, v2.1.269+), `OTEL_RESOURCE_INCLUDE_HOST=1` (`host.name`, `host.id`, v2.1.326+), `OTEL_LOG_TOOL_DETAILS=1` (unredacts custom `agent.name`/`mcp_server.name`/`mcp_tool.name`) (F25, F26).
- **8 exported OTel metrics:** `claude_code.session.count` (`start_type`: `"fresh"|"resume"|"continue"|"agents_view"`), `claude_code.lines_of_code.count` (`type`: `"added"|"removed"`, `model`), `claude_code.pull_request.count`, `claude_code.commit.count` (join on `session.id` with `query_source == "main"` for model attribution), `claude_code.cost.usage` (`USD`; `model`, `query_source`, `agent.name`, `skill.name`), `claude_code.token.usage` (`tokens`; `type`: `"input"|"output"|"cacheRead"|"cacheCreation"`), `claude_code.code_edit_tool.decision` (`tool_name`, `decision`, `source`, `language`), `claude_code.active_time.total` (`s`; `type`: `"user"|"cli"`) (F24, F25, F28).
- **Key events & correlation:** `claude_code.api_error` (`attempt`, `status_code`, `request_id`, `client_request_id` — emitted only after retry exhaustion; `CLAUDE_CODE_MAX_RETRIES=10`, max `attempt=11`, resets to `1` after streaming failure) (F27); `claude_code.api_refusal` (`server_fallback_hop`, `has_category`, `category`) (F28); `prompt.id`, `agent_id`, `parent_agent_id` (v2.1.310+), `workflow.run_id` (F26).
- **Analytics dashboards:** Team/Enterprise (`claude.ai/analytics/claude-code`, Enterprise Analytics API `read:analytics`) includes GitHub `claude-code-assisted` PR/LOC metrics (21d before to 2d after merge; >20% rewrite excluded; disabled under ZDR); API Console (`platform.claude.com/claude-code`, Claude Code Analytics API) shows usage, accept rate, and spend only (F30).

## Practitioner reasoning

### Choosing a parallel topology for engineering work `[INFERENCE]`

1. **Stay in a single session** when changes are sequential, touch the same files, or share heavy prior context—spawning a fresh subagent forces cold-start context gathering and can take *longer* than editing in place (F14, F19).
2. **Use `isolation: worktree` subagents or `/batch`** for 5–30 independent, well-bounded code changes (migrations, per-module refactors, test additions) that need clean diffs and automated PRs without peer debate (F9, F11, F12).
3. **Use `claude --worktree` or `claude agents` (`--bg`)** when running 2–5 independent tasks interactively in parallel and inspecting/merging branches yourself, or using a second clean session as an un-biased code reviewer (F2, F10, F19).
4. **Use Agent Teams** only in interactive sessions where workers need direct peer-to-peer messaging and debate (competing bug hypotheses, cross-layer API contract negotiation), strictly partitioned by file ownership and capped at ~3–5 teammates (F12, F13, F14).
5. **Use Dynamic Workflows** when fanning out across dozens to thousands of items (`<= 4,096` per call, `<= 1,000` agents/run) where holding loop state in JavaScript avoids coordinator context bloat and `5,000 ms` prefix staggering preserves prompt-cache hit rates (F17).

### Task decomposition, merge sequencing, and conflict strategy

- **Decompose by disjoint ownership or oracle slices, not monolithic goals:** `[INFERENCE]` Pointing multiple agents at one monolithic failing build causes *herd collision*—every worker diagnoses the same top error, edits the same file, and overwrites siblings' patches (F21). Decompose either by disjoint file/module ownership (F12, F14), git-tracked task lockfiles (`current_tasks/*.txt`) (F20), or differential/oracle slicing (e.g., compiling 95% of files with a known-good reference and isolating failing subsets) (F21).
- **Size tasks at the Goldilocks boundary:** Tasks that are too small lose to startup/coordination overhead; tasks that are too large exhaust context or drift before verification. Target 5–6 self-contained deliverables per teammate (each producing a function, module, or test suite) (F14).
- **Merge sequencing & integration verification:** `[INFERENCE]`
  1. *Require worktree-local verification before merge:* Run unit tests/typecheck inside each worktree (enforced deterministically by `TaskCompleted` or `Stop` hooks exiting `2`) (F16, F19) and set `worktree.baseRef: "head"` only when workers must build atop unpushed local commits (F4).
  2. *Serialize integration onto main/integration branch:* Never let parallel workers push directly to `main` or `master` (F10). Merge or rebase completed worktree branches one at a time against the moving tip, re-running full integration tests after each merge—because two patches that pass independently in isolated worktrees can still fail together (semantic/ABI conflicts requiring delta debugging across pairs) (F21).
  3. *Separate review context from writer context:* Route merged or PR diffs through a read-only reviewer subagent (`tools: Read, Grep, Glob`) or `/code-review` that never saw the writer's reasoning (F19).

### Fleet failure-mode table (diagnosing from fleet telemetry)

| Fleet failure mode | Mechanism / root cause | Telemetry & dashboard detection signal | Containment & recovery |
|---|---|---|---|
| **Quota exhaustion & retry storm (`429` / overload)** | Unbounded parallel workers saturate shared org RPM/TPM limits `[INFERENCE]` (F18) | Spike in `claude_code.api_error` (`status_code=429`/`529`, `attempt=11` from `CLAUDE_CODE_MAX_RETRIES=10`) with no subsequent `api_request` in the same `session.id` (F27) | Cap workflow concurrency (`CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`), keep teams to 3–5 teammates (F14), enable `5,000 ms` prefix stagger (F17), and route routine workers to Sonnet/Haiku (F18, F19). |
| **Herd collision / same-task thrashing** | Multiple agents lack disjoint ownership or attack one monolithic blocker simultaneously (F14, F21) | High `claude_code.cost.usage` and `lines_of_code.count` (`added` + `removed` churn) paired with flat `commit.count` / `pull_request.count` and high `>20%` rewrite exclusions `[INFERENCE]` (F24, F30) | Enforce disjoint file ownership or `current_tasks/` lockfiles (F14, F20); split monoliths with a known-good oracle + delta debugging (F21); use `isolation: worktree` (F9). |
| **Silent headless worktree & lock leak** | `claude -p --worktree` skips exit cleanup prompts and leaves git worktree locks on disk (F8) | Growing `.claude/worktrees/` directories across build hosts (`host.name` via `OTEL_RESOURCE_INCLUDE_HOST=1`) and blocked git checkouts `[INFERENCE]` (F8, F26) | Run `git worktree unlock <path> && git worktree remove <path>` in CI/orchestrator `finally` blocks instead of relying on interactive exit prompts (F8). |
| **Prompt-cache cold-start burn** | Parallel workers launch simultaneously without staggering, or bloated spawn prompts/unclosed idle teammates multiply prefix reads (F17, F18) | Elevated `claude_code.token.usage` (`type="cacheCreation"` or uncached `"input"` vs `"cacheRead"`), segmented by `agent.name` / `query_source="subagent"` (F25) | Keep default `CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS=5000` (F17), trim spawn prompts, use `omitClaudeMd: true` where safe, and shut down finished teammates (F18). |
| **Premature completion / unverified merge** | Workers declare done after smoke checks or skip integration tests without deterministic gates (F16, F22, F23) | High `commit.count` / `pull_request.count` paired with CI reverts or low `code_edit_tool.decision` acceptance `[INFERENCE]` (F24) | Enforce full test/typecheck in `TaskCompleted` / `TeammateIdle` / `Stop` hooks (exit `2`) (F16, F19); disable `CLAUDE.md`-only enforcement in favor of CI + read-only reviewer subagent (F19, F22). |
| **Stalled task dependency / dead in-process team** | Teammate fails to mark a task complete (blocking downstream tasks), or `/resume` is run on an in-process team (F15) | Zero `claude_code.active_time.total` (`type="cli"`) and missing `api_request` events for `agent_id` while `session.id` remains open `[INFERENCE]` (F24, F26) | Check task list manually, nudge/replace stalled teammate (F15); never rely on `/resume` to revive in-process teammates—re-spawn from persisted artifacts/git state (F15, F23). |
| **Safety refusal masked as healthy or ignored** | Workers hit policy boundaries (`stop_reason: "refusal"`), which does not emit `api_error` (F28) | Rising `claude_code.api_refusal` events (`server_fallback_hop=false`, `category`) while `api_error` stays flat (F28) | Alert on `claude_code.api_refusal` alongside `api_error`, inspect `category` (`OTEL_LOG_TOOL_DETAILS=1`), and narrow prompt/tool scope (F28). |
| **Misleading fleet KPIs (UI inflation & attribution skew)** | Counting `claude agents` UI sessions as workers, attributing subagent commits to wrong models, or expecting GitHub PR metrics under ZDR / API Console (F25, F28, F30) | Inflated `session.count` (`start_type="agents_view"`), misattributed commit-per-model charts, or missing `claude-code-assisted` PR data (F25, F28, F30) | Filter `start_type != "agents_view"` (F25); join `commit.count` to `cost.usage` on `session.id` with `query_source="main"` (F28); use OTel `pull_request.count` instead of GitHub analytics under ZDR/API plans (F24, F30). |

## Worked example(s)

### 1. Non-interactive worktree fan-out with serialized integration & cleanup (Bash)

*Status: Verified CLI syntax from `worktrees.md` and `monitoring-usage.md`; orchestration wrapper is an original operational pattern.*

```bash
#!/usr/bin/env bash
set -euo pipefail

export CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_METRICS_EXPORTER=otlp OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector.internal:4317"
export OTEL_METRICS_INCLUDE_REPOSITORY=true OTEL_RESOURCE_INCLUDE_HOST=1

MODULES=("auth" "billing" "webhooks" "search")
PIDS=()
for mod in "${MODULES[@]}"; do
  claude -p --worktree "mig-${mod}" --permission-mode acceptEdits --max-budget-usd 5.00 \
    "Migrate src/${mod}/ to ESM. Own ONLY src/${mod}/ and tests/${mod}/. Run pnpm test -- tests/${mod}/ and commit." \
    > "logs/mig-${mod}.log" 2>&1 &
  PIDS+=($!)
done

FAILED=0
for pid in "${PIDS[@]}"; do wait "$pid" || FAILED=1; done

git checkout -b integrate/esm-migration origin/main
for mod in "${MODULES[@]}"; do
  BRANCH="worktree-mig-${mod}" WT=".claude/worktrees/mig-${mod}"
  if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    if git merge --no-ff "$BRANCH" -m "Merge ${BRANCH}"; then
      pnpm test
    else
      git merge --abort; FAILED=1
    fi
  fi
  if [ -d "$WT" ]; then
    git worktree unlock "$WT" 2>/dev/null || true
    git worktree remove --force "$WT"
  fi
done
exit "$FAILED"
```

### 2. Diagnosing a stalled fleet wave from OTel telemetry (Python) `[INFERENCE]`

*Status: Pseudocode over documented OTel event/metric schemas (`monitoring-usage.md`).*

```python
worker_sessions = {
    m["attributes"]["session.id"]
    for m in session_count_metrics
    if m["attributes"].get("start_type") != "agents_view"
}
errors_by_session, last_success_ts = {}, {}
for ev in log_events:
    sid = ev["attributes"]["session.id"]
    if ev["name"] == "claude_code.api_request":
        last_success_ts[sid] = max(last_success_ts.get(sid, ""), ev["timestamp"])
    elif ev["name"] == "claude_code.api_error":
        errors_by_session.setdefault(sid, []).append(ev)

stalled_sessions = [
    sid for sid, errs in errors_by_session.items()
    if any(e["attributes"].get("attempt", 0) >= 11 for e in errs)
    and last_success_ts.get(sid, "") < errs[-1]["timestamp"]
]
# Also query claude_code.api_refusal (server_fallback_hop == False): refusals do not emit api_error.
```

## Diagram spec

- **Type:** flow (parallel-worktree fan-out and serialized merge pipeline)
- **Nodes / actors:**
  - `MainRepo`: Main repository (`origin/main`, shared `.git/`, `.worktreeinclude`)
  - `WT1`, `WT2`, `WT3`: Isolated worktrees (`.claude/worktrees/mod-a`, `mod-b`, `mod-c` on branches `worktree-mod-a`, `worktree-mod-b`, `worktree-mod-c`; optional `.worktreeinclude` `.env` copy)
  - `Worker1`, `Worker2`, `Worker3`: Parallel Claude sessions (`claude -p --worktree` or `isolation: worktree` subagents), each with disjoint file ownership + local `TaskCompleted`/`Stop` test gate
  - `IntBranch`: Serialized integration queue (`integrate/<task>`)
  - `MergeGate`: Per-merge full integration suite + fresh read-only reviewer subagent (`tools: Read, Grep, Glob`)
  - `Cleanup`: `git worktree unlock` + `git worktree remove` (for `-p` runs) -> `origin/main` PR
- **Edges / messages:**
  1. `MainRepo` --(branch from `fresh` or `head` + copy `.worktreeinclude`)--> `WT1`, `WT2`, `WT3`
  2. `Worker1`, `Worker2`, `Worker3` --(4 isolation checks block main-checkout edits/git redirects)--> `WT1`, `WT2`, `WT3`
  3. `WT1` --(unit tests pass; commit `worktree-mod-a`)--> `IntBranch`
  4. `WT2` --(unit tests pass; commit `worktree-mod-b`)--> `IntBranch`
  5. `WT3` --(unit tests pass; commit `worktree-mod-c`)--> `IntBranch`
  6. `IntBranch` --(merge 1 branch at a time)--> `MergeGate` --(full integration tests + fresh reviewer pass; if pair fails, delta-debug/rebase)--> `Cleanup`
  7. `Cleanup` --(open PR to `MainRepo`; unlock & remove `-p` worktrees)--> `MainRepo`
- **Caption:** Parallel Claude sessions edit disjoint modules inside isolated git worktrees sharing `.git` and `.worktreeinclude` secrets, then serialize merges through full integration testing, independent diff review, and explicit `-p` worktree unlock/cleanup.

## Exam lens

*(Editorial inference based on official skill 8.1 scope; not real exam items.)*

1. **Isolation vs. topology mismatch:** An agent team or parallel session group overwrites edits in the same directory. *Pattern:* Agent teams do not auto-isolate teammates in worktrees (requiring strict file partitioning or switching to worktree sessions/subagents), and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is ignored in `-p`/SDK runs (F12, F13).
2. **Monolithic parallel bottleneck:** Many parallel agents hit the same top build error and clobber each other's fixes. *Pattern:* Replace unpartitioned retries with task lockfiles, disjoint file ownership, or a known-good oracle + delta-debugging split (F20, F21).
3. **Fleet telemetry root-cause triage:** Rising spend with flat commits, `api_error` (`attempt=11`), or halted PRs with zero `api_error`. *Pattern:* Check for missing subsequent `api_request` per `session.id` (`429` retry exhaustion -> cap concurrency + stagger cache) (F17, F27), query `api_refusal` separately (F28), exclude `start_type="agents_view"` (F25), and join `commit.count` on `query_source="main"` (F28).
4. **Headless worktree & OTel config traps:** CI runs `claude -p --worktree` with OTel vars in repo `.claude/settings.json`. *Pattern:* `-p` skips exit prompts and leaves locked worktrees (`git worktree unlock`/`remove` required) (F8), and OTel exporter vars in repo settings are ignored (F24).

## Common mistakes

- **Running `agent-teams` expecting automatic worktree isolation or `-p`/SDK support:** Agent teams share the working tree (requiring explicit file partitioning) and are ignored in `-p`/Agent SDK runs (F12, F13).
- **Omitting `git worktree unlock` / `remove` in `-p` automation:** Non-interactive `-p --worktree` runs exit without prompting to clean up and leave git locks on disk (F8).
- **Putting OTel exporter config in `.claude/settings.json`:** Claude Code ignores `OTEL_*` exporter settings in repo-level `.claude/settings.json` and `.claude/settings.local.json` for security (F24).
- **Pointing many parallel agents at one shared failing build without an oracle or lock:** Causes duplicate debugging and mutually destructive overwrites (F21).
- **Assuming `claude_code.api_error` captures every model stop or retry:** `api_error` fires only after retries exhaust (and `stop_reason: "refusal"` emits `claude_code.api_refusal` instead) (F27, F28).
- **Assuming `worktree` checks block shell file copies (`cp`/`>`) into main:** Worktree checks inspect tool paths, command `cwd`, git redirects, and command shape—not arbitrary shell output paths (F6).
- **Expecting GitHub PR contribution metrics on API Console or ZDR orgs:** GitHub attribution (`claude-code-assisted`, 21d/2d window) is Teams/Enterprise-only and disabled under Zero Data Retention (F30).

## Self-check

1. **Q:** You launch 20 `claude -p --worktree` workers in CI and configure `OTEL_METRICS_EXPORTER=otlp` in the repo's `.claude/settings.json`. Name two operational failures that occur.
   **A:** (1) Repo `.claude/settings.json` OTel exporter vars are ignored, so no OTel telemetry is exported (must use managed settings, `~/.claude/settings.json`, or launch env) (F24); (2) `-p` skips exit prompts and leaves locked worktrees on disk until `git worktree unlock` + `git worktree remove` (or a later stale-lock sweep) runs (F8).
2. **Q:** In fleet telemetry, `claude_code.api_error` count is zero, yet half your parallel coding agents stopped producing PRs after touching sensitive auth code. What should you inspect?
   **A:** Query `claude_code.api_refusal` events (filtered to `server_fallback_hop=false`), because `stop_reason: "refusal"` arrives on a successful stream and does not emit `api_error` (F28).
3. **Q:** When should `worktree.baseRef` be changed from `"fresh"` to `"head"`, and why?
   **A:** Set `worktree.baseRef: "head"` when isolated subagents or worktree sessions need to branch from unpushed local commits on your current feature branch rather than the remote default branch (`"fresh"`) (F4).

## Unresolved

- **Exact `claude_code.subagent_completed` event schema:** Referenced in `monitoring-usage.md` under `agent_id` (`#subagent-completed-event`), but the full attribute list for that anchor was not extracted in full during this pass.
- **Exact `agent_id` behavior for split-pane vs. in-process Agent Teams in OTel:** `monitoring-usage.md` notes `agent_id` on events is absent on main-session and in-process teammate events; whether split-pane tmux teammates emit distinct `session.id` values with or without `parent_agent_id` was not explicitly stated in the sections read.
