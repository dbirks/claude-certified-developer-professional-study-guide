# 8.2 Verification and AI Code Review Operations

Analyzing verification operations in delivery pipelines where generation outpaces review, including AI code review introduced in shadow mode, calibration against human review before merge gating, and human oversight design.

## Scope map

- Verification operations where generation outpaces review → Core facts; Exact API / config details; Practitioner reasoning; Worked example(s); Diagram spec.
- AI code review introduced in shadow mode → Core facts; Exact API / config details; Practitioner reasoning; Worked example(s); Exam lens.
- Calibration against human review before merge gating → Core facts; Exact API / config details; Practitioner reasoning; Worked example(s); Exam lens; Common mistakes.
- Human oversight design → Core facts; Exact API / config details; Practitioner reasoning; Exam lens; Common mistakes; Self-check.

## Core facts

- **Generation outpaces review:** Code output per Anthropic engineer grew 200% year-over-year (F1) and engineers ship 8x as much code per quarter as in 2021–2025, with Claude authoring ~80% of merged code company-wide (F2) and ~90% of Claude Code's codebase (F3). Daily monorepo changes rose from ~2,500 (May 2026) to >30,000 (September 2026), making manual line-by-line review an Amdahl's Law bottleneck (F2) (F4).
- **Verification capacity gates parallel delegation:** Without verification loops, an engineer can supervise only 1–2 Claude sessions manually; with them, one engineer can run dozens or hundreds in parallel (F5). On Claude Code (June–September 2026), merged PRs more than doubled while revert share fell >40% (F3).
- **Pre-PR verification loops:**
  - Give Claude deterministic pass/fail checks (tests, build exit code, linter, fixture diff, browser screenshot) so it self-corrects, and require command output as evidence rather than trusting "tests pass" claims (F6).
  - `Stop` hooks enforce checks at turn end: exit code `2` blocks stopping and feeds `stderr` back to Claude, up to an 8-consecutive-continuation cap (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) (F7).
  - `/goal` wraps a session-scoped prompt-based `Stop` hook using a small fast model to return `Met`, `Not yet met`, or `Impossible` from conversation evidence (F8).
  - `/verify` builds, launches, and observes the running app rather than relying on unit tests or typechecks alone; project `verify`/`simplify` skills auto-run before commits on v2.1.286+ (F9).
  - E2E tests, property-based tests (`fast-check`, `Hypothesis`, `proptest`), and differential tests resist agent gaming better than unit tests; Anthropic escalates checks still failing after three repair rounds to a human (F10). Adding a separate rubric grader improved structured-file task success by up to 10 points (F11).
- **Managed Code Review:**
  - Available on Team/Enterprise for GitHub and GHES (unavailable under ZDR, HIPAA, or CMEK), Code Review runs on Anthropic infrastructure in four stages: **Find** (parallel diff + codebase agents), **Verify** (drops false positives), **Rank** (deduplicates by severity), and **Post** (inline comments, summary, `Claude Code Review` check run) (F12).
  - Reviews are read-only (no code execution) and tag findings 🔴 **Important**, 🟡 **Nit**, or 🟣 **Pre-existing** (F12) (F13). The check run concludes `neutral` or `skipped`—never `failure`—leaving merge blocking to repository rules or CI scripts parsing `<!-- bughunter-severity: ... -->` (F13) (F14).
  - Admins configure depth (`Quick`, `Standard`, `Deep`), cadence (`Once after PR creation`, `After every push`, `Manual (@claude review)`), and monthly spend caps (~$15–$25/review via usage credits); automatic reviews skip drafts and forks (F15). `REVIEW.md` and `CLAUDE.md` customize checks, with `REVIEW.md` read strictly from the protected base/default branch (F16).
- **Local, cloud, and security CLI reviews:**
  - `/code-review` (alias `/review`) runs in a fresh forked subagent context (unbiased by the author session), reads `CLAUDE.md` (not `REVIEW.md`), and uses effort levels (`low`–`max`) to trade precision for coverage (F17). `/code-review ultra` (`/ultrareview`) and `claude ultrareview` run a cloud-sandbox multi-agent fleet (500 files / 8,000 lines cap, ~5–15 min) that independently reproduces findings (F18).
  - `/security-review` scans the current branch diff against origin's default branch (F21); the `security-guidance` plugin layers deterministic per-edit pattern matching, end-of-turn background diff review, and fresh-context commit/push review (F22).
- **GitHub Actions (`claude-code-action` & `claude-code-security-review`):**
  - `anthropics/claude-code-action@v1` runs on GitHub runners in interactive (`@claude` mention) or automation (`prompt` input) mode, supports OIDC workload identity federation (`id-token: write`), enforces write-access and non-bot checks, requires a distinct `trigger_phrase` alongside Code Review (F19), and restores `.claude/`, `.mcp.json`, `CLAUDE.md`, etc. from the base/default branch (F20).
  - `anthropics/claude-code-security-review@main` runs semantic diff-aware security scans with two-stage false-positive filtering (deterministic exclusions + Claude confidence analysis) and requires maintainer approval on external fork PRs against prompt injection (F21).
- **Shadow mode, calibration, convergence, and oversight:**
  - Anthropic deploys new AI reviewers in **shadow mode** (comment-only for human approval until trust is earned) plus red-teaming (F23), and rolls out gates across `off`, `observe` (log-only false-positive audit), and `enforce` (F24).
  - Reviewers are calibrated against an incident/revert eval set plus clean merged PRs as a false-positive control, measuring recall separately at raw, post-verification, and final stages (F25). Internal Code Review raised substantive PR comments from 16% to 54% (84% on >1,000-line PRs avg 7.5 issues vs. 31% on <50-line PRs avg 0.5) with <1% marked incorrect (F26).
  - Because agent authors fix every nit and trigger new commits (>50 rounds on one CLI PR), convergence controls (3-round cap, diff-only re-review, bug-class flagging, duplicate suppression) raised 1-round passes from 65% to 78%, cut 5+ round PRs from 8.9% to 1.5%, and reduced mean reviews from 2.08 to 1.32 (F27) (F28).
  - Human approvals scale by risk tier (Low: 0 humans for trusted authors; Medium: 1 human; High/`CODEOWNERS`: 2 humans), bot approvals never replace humans (F29), and teams track median/p95 human approvals and wait time against revert/incident guardrails (F30).
  - Provenance uses `attribution` (`Co-Authored-By: <model> <noreply@anthropic.com>`, PR footer, `sessionUrl`) (F31) and commit verification stamps including `"none"` (F32).

## Exact API / config details

- **Managed Code Review (`code.claude.com/docs/en/code-review*`):**
  - **Check run & severity markers:** Check run name is `Claude Code Review`; conclusions are `neutral` or `skipped` (never `failure`) (F13). Severity markers are `🔴 Important`, `🟡 Nit`, `🟣 Pre-existing` (F12) (F13).
  - **Programmatic CI merge-gate payload (last line of check run `output.text`):**
    ```html
    <!-- bughunter-severity: {"nit":1,"normal":2,"pre_existing":0} -->
    ```
    Parse `output.title` before `output.text`: if title starts with `Code review not repeated`, earlier `Important` findings remain open (no severity line is emitted); if title ends with `no new changes`, allow pass; if `normal > 0`, fail the merge gate; if the severity comment is missing (`error("no severity line")`), treat as **no verdict** rather than zero findings (failed, timed-out, canceled, or superseded run) (F14).
  - **Admin & repository settings:** Review levels `Quick`, `Standard` (default), `Deep`; **Review runs** modes `Once after PR creation`, `After every push` (default on newly added repos), `Manual (@claude review)` (F15).
  - **PR comment commands (must start a new top-level PR comment from a user with write/maintain/admin access on the open PR):** `@claude review`, `@claude review once`, `@claude review always` (subscribes PR to push-triggered reviews in Manual/Once modes), `@claude review stop` / `off` / `pause` (F15).
  - **`REVIEW.md` constraints:** Read from protected base/default branch only; subdirectory `REVIEW.md` files ignored under `test`, `tests`, `__tests__`, `testdata`, `fixtures`, `generated`, `vendor`, `node_modules`, etc.; combined subdirectory limit `150,000` bytes; root `@filename` includes support max `8` files, `<= 64` non-URL/anchor Markdown links (exceeding 64 skips the entire root `REVIEW.md`), and `30,000` bytes max per `.claude/skills/<folder>/SKILL.md` (F16).
- **Local & Cloud CLI Review (`code.claude.com/docs/en/code-review-local`, `ultrareview`, `commands`, `hooks`):**
  - **`/code-review` (alias `/review`):** `/code-review [low|medium|high|xhigh|max|ultra] [--fix] [--comment] [--max-findings n|all|default] [pr#|branch|path]` (F17).
  - **`claude ultrareview` (non-interactive CLI):** `claude ultrareview [pr#|branch] [--json] [--timeout <minutes>] [--post|--no-post] [--trust-workspace]`. Default `--timeout` is `45` minutes; default diff cap is `500` changed files and `8,000` changed lines; exits `0` (completed), `1` (launch/session error, timeout, or untrusted workspace), or `130` (Ctrl-C) (F18).
  - **`Stop` hook enforcement (`.claude/settings.json`):** `hooks.Stop` command returning exit code `2` blocks turn end and sends `stderr` back to Claude; capped at `8` consecutive continuations without tool calls unless `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` is raised (F7).
  - **`/goal`:** `/goal [condition|clear]`, max `4,000` characters; evaluator returns `Met`, `Not yet met`, or `Impossible` (F8).
- **GitHub Actions (`anthropics/claude-code-action@v1` & `anthropics/claude-code-security-review@main`):**
  - **`claude-code-action@v1` key inputs:** `prompt`, `claude_args`, `anthropic_api_key`, `claude_code_oauth_token`, `github_token`, `trigger_phrase` (default `@claude`), `plugins`, `plugin_marketplaces`, `settings`, `use_bedrock`, `use_vertex`, `use_foundry`, `allowed_non_write_users`, `allowed_bots`, plus OIDC federation inputs (`anthropic_federation_rule_id`, `anthropic_organization_id`, `anthropic_service_account_id`, `anthropic_workspace_id` with `id-token: write`) (F19).
  - **Base-branch config restoration list (PR security boundary):** `.claude/`, `.mcp.json`, `.claude.json`, `.gitmodules`, `.ripgreprc`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `.husky/` (F20).
  - **`claude-code-security-review@main` inputs/outputs:** inputs `claude-api-key` (required), `comment-pr` (`true`), `upload-results` (`true`), `exclude-directories`, `claude-model` (default `claude-opus-4-1-20250805`), `claudecode-timeout` (`20` min), `run-every-commit` (`false` — `true` warns of higher false positives on multi-commit PRs), `false-positive-filtering-instructions`, `custom-security-scan-instructions`; outputs `findings-count`, `results-file` (F21).
- **Provenance settings (`.claude/settings.json`):**
  - `attribution.commit`: string trailer (default `Co-Authored-By: <model> <noreply@anthropic.com>`; `""` hides) (F31).
  - `attribution.pr`: string footer (default `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; `""` hides) (F31).
  - `attribution.sessionUrl`: boolean (default `true`; controls `Claude-Session` commit trailer and PR link) (F31).
  - `attribution: false`: hides all attribution on Claude Code v2.1.281+ (earlier versions reject boolean `false` and skip the settings file); `includeCoAuthoredBy` is deprecated (F31).

## Practitioner reasoning

- **Design verification as a multi-layer funnel, not a single PR gate:** `[INFERENCE]` Relying solely on a PR-time AI reviewer replicates the human review bottleneck in token spend and latency. Shift cheap deterministic checks left into the inner loop (`CLAUDE.md` commands, `PostToolUse` formatters, `Stop` hooks for `tsc`/tests, `/verify`, and the 3-layer `security-guidance` plugin), run multi-agent correctness + security review on PRs, and use a merge queue + feature flags + rapid rollback downstream (F6) (F7) (F9) (F22).
- **Why tests must resist agent gaming:** Agents optimize for passing the signal in front of them; unit tests with narrow mocks can pass while end-to-end flows break, and flaky tests train agents to retry rather than fix bugs (F10). Pair E2E harnesses with property-based invariants (`Hypothesis`/`fast-check`) and differential testing against the legacy implementation, and cap autonomous fix attempts at three rounds before escalating to a human (F10).
- **Shadow-mode rollout before merge gating:** Never turn on a new AI reviewer or verification gate as a hard merge blocker on day one. Run in shadow/`observe` mode (`neutral` check run or log-only commit gate) for 2–4 weeks across representative repos (F13) (F23) (F24). Measure:
  1. **Confusion matrix against human/incident ground truth** (Precision, Recall, False Positive Rate) using both an incident/revert eval set and a clean-PR control set (F25).
  2. **Stage-by-stage recall** (raw candidate findings vs. post-verification survivors vs. final posted comments) so an over-aggressive false-positive filter does not silently strip real bugs (F25).
  3. **Comment disposition** (fixed vs. rejected as wrong vs. intentional vs. ignored) and **rounds-to-pass** (F27) (F28).
  Only promote `Important` (`normal > 0`) findings or security findings to a CI merge gate once precision is calibrated, `REVIEW.md` exclusions/nit caps are tuned, and convergence controls (3-round cap, diff-only re-review) are active (F14) (F16) (F28).
- **Managing reviewer fatigue and agent-author loops:** `[INFERENCE]` Human reviewers ignore an AI reviewer whose false-positive rate is high ("alert fatigue"), whereas agent authors dutifully try to fix every nit, burning CI minutes and pushing noisy commits that invalidate prior human approvals (F27) (F29). Suppress style/cleanup nits in `REVIEW.md` (or cap at e.g. 5 nits, require `file:line` evidence, skip CI-checked lint/type errors), separate `Important` blocking defects from `Nit`/`Pre-existing` annotations, and enforce a 3-round convergence cap (F13) (F16) (F28).
- **Tamper-resistant checks and human accountability:** A change must never be able to weaken the check that evaluates it (F16) (F20). Read `REVIEW.md` and `.claude/` configs strictly from a branch-protected base/default branch, pin human `CODEOWNERS` on sensitive paths (auth, billing, CI workflows, installers), bind approvals to a commit SHA (dismissing on new untrusted pushes), never let a bot approval satisfy a human approval slot, and track revert/incident rates alongside human review wait time so speed gains are real (F16) (F20) (F29) (F30).

## Worked example(s)

### 1. Shadow-Mode Confusion Matrix & Calibration Evaluator (Runnable Python 3)

Suppose an engineering team runs a candidate AI code reviewer in shadow mode (`comment-only`, `neutral` check run) over **200 PRs** before deciding whether to enforce `Important` findings as a CI merge gate. Ground truth combines **40 positive PRs** (historical incidents/reverts + human-confirmed defects) and **160 clean control PRs** (merged without incident or human rejection, as in Anthropic's calibration design (F25)).

- **Baseline (unfiltered high-recall prompt):** Flags `38` of `40` defective PRs (`TP=38, FN=2`) but also flags `42` of `160` clean PRs (`FP=42, TN=118`). Precision = `38 / 80 = 47.5%`, FPR = `42 / 160 = 26.25%`. More than half of blocking alerts would be false alarms—causing human reviewer fatigue and triggering ~42 unnecessary agent re-work loops.
- **Calibrated (2-stage verification filter + `REVIEW.md` nit cap & CI-overlap exclusions):** Flags `34` of `40` defective PRs (`TP=34, FN=6`) and only `6` of `160` clean PRs (`FP=6, TN=154`). Precision = `34 / 40 = 85.0%`, Recall = `34 / 40 = 85.0%`, FPR = `3.75%`.

```python
# Runnable Python 3.10+ (standard library only) — Shadow-Mode Reviewer Gate Evaluator
from dataclasses import dataclass

@dataclass(frozen=True)
class ShadowEvalCounts:
    tp: int  # Defective PRs correctly flagged as Important
    fp: int  # Clean control PRs wrongly flagged as Important
    fn: int  # Defective PRs missed (passed as clean)
    tn: int  # Clean control PRs correctly passed

    def metrics(self) -> dict[str, float]:
        precision = self.tp / (self.tp + self.fp)
        recall = self.tp / (self.tp + self.fn)
        fpr = self.fp / (self.fp + self.tn)
        f1 = 2 * precision * recall / (precision + recall)
        return {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "fpr": round(fpr, 4),
            "f1": round(f1, 4),
        }

def ready_for_merge_gate(
    counts: ShadowEvalCounts,
    min_precision: float = 0.80,
    min_recall: float = 0.75,
    max_fpr: float = 0.05,
) -> tuple[bool, dict[str, float]]:
    m = counts.metrics()
    passed = (
        m["precision"] >= min_precision
        and m["recall"] >= min_recall
        and m["fpr"] <= max_fpr
    )
    return passed, m

unfiltered = ShadowEvalCounts(tp=38, fp=42, fn=2, tn=118)
calibrated = ShadowEvalCounts(tp=34, fp=6, fn=6, tn=154)

for name, run in [("unfiltered_baseline", unfiltered), ("calibrated_verified", calibrated)]:
    ok, stats = ready_for_merge_gate(run)
    print(f"{name}: gate_ready={ok} metrics={stats}")
```

### 2. GitHub Actions Merge Gate Parsing `bughunter-severity` (Non-runnable Workflow Sketch)

Illustrative GitHub Actions step gating merges on managed `Claude Code Review` `Important` findings (`normal > 0`), following Anthropic's documented check-run parsing order (F14) and handling missing verdicts fail-closed:

```yaml
# Non-runnable CI sketch (requires gh CLI with checks:read permission)
- name: Enforce Claude Code Review Important findings
  env:
    GH_TOKEN: ${{ github.token }}
    HEAD_SHA: ${{ github.event.pull_request.head.sha }}
  run: |
    CHECK_ID=$(gh api "repos/${{ github.repository }}/commits/${HEAD_SHA}/check-runs" \
      --jq '[.check_runs[] | select(.name == "Claude Code Review")] | first | .id // empty')
    if [ -z "$CHECK_ID" ]; then
      echo "Missing Claude Code Review check run" >&2
      exit 1
    fi
    TITLE=$(gh api "repos/${{ github.repository }}/check-runs/${CHECK_ID}" --jq '.output.title')
    if [[ "$TITLE" == "Code review not repeated"* ]]; then
      echo "Earlier Important findings remain open: $TITLE" >&2
      exit 1
    fi
    if [[ "$TITLE" == *"no new changes" ]]; then
      exit 0
    fi
    NORMAL=$(gh api "repos/${{ github.repository }}/check-runs/${CHECK_ID}" --jq '
      (.output.text | split("\n") | last
        | scan("^<!-- bughunter-severity: (.*) -->$")[0] | fromjson | .normal)?
      // error("no severity line")')
    if [ "$NORMAL" -gt 0 ]; then
      echo "Blocked: $NORMAL Important finding(s) open" >&2
      exit 1
    fi
```

## Diagram spec

- **Type:** `flow`
- **Nodes and edges:**
  - `Pre-PR Inner Loop` (tests, linters, `Stop` hook exit `2`, `/verify`, `/code-review`, `/security-review`, `security-guidance` plugin) → `PR Opened / Updated`
  - `PR Opened / Updated` → `Deterministic Required CI` (lint, types, E2E/property/differential tests)
  - `PR Opened / Updated` → `AI Code & Security Review (Shadow / Observe Mode)` (parallel Find → Verify → Rank; `REVIEW.md` read from protected base branch)
  - `AI Code & Security Review (Shadow / Observe Mode)` → `Calibration Eval & Telemetry` (confusion matrix vs. incident/revert eval + clean PR control set, comment disposition, rounds-to-pass)
  - `Calibration Eval & Telemetry` → `Enforced Merge Gate` (requires precision/FPR calibrated; parses `bughunter-severity` `normal > 0` + thread resolution; 3-round convergence cap)
  - `Deterministic Required CI` → `Risk-Tiered Human Oversight`
  - `Enforced Merge Gate` → `Risk-Tiered Human Oversight` (Low: 0 humans for trusted authors; Medium: 1 human; High/`CODEOWNERS`: 2 humans; bot approval never replaces human)
  - `Risk-Tiered Human Oversight` → `Merge Queue -> Staged Release & Flags -> Fast Rollback`
  - `Merge Queue -> Staged Release & Flags -> Fast Rollback` → `Incident / Revert Feedback Loop` → updates `CLAUDE.md`, `REVIEW.md`, and `Calibration Eval & Telemetry`
- **Caption:** End-to-end verification and AI code review lifecycle showing how pre-PR feedback loops, shadow-mode calibration, and risk-tiered human oversight gate high-velocity agent delivery without regressing revert or incident rates.

## Exam lens

*All patterns below are editorial inference grounded in documented Claude Code operations and the November 2026 official exam blueprint.*

- **Shadow-mode rollout before merge gating:** When a scenario introduces an AI code reviewer (or new verification gate) onto a high-velocity pipeline, choose rolling it out in shadow / `observe` mode (`neutral` check run, comment-only) and calibrating precision/recall against human-labeled incidents and clean control PRs **before** blocking merges—matching the LLM-judge calibration pattern in official exam guide §7 (F23) (F24) (F25).
- **Fixing agent-author review loops and false-positive fatigue:** When an automated reviewer causes PRs to bounce through dozens of commits or causes human reviewers to ignore comments, diagnose nit inflation and lack of convergence controls; the fix is secondary verification filtering, `REVIEW.md` exclusions/nit caps, diff-only re-review after early passes, and a 3-round convergence cap rather than adding a second stacked reviewer model (F12) (F16) (F27) (F28).
- **Tamper-resistant checks and check-run gating mechanics:** If a scenario asks why a PR bypassed a review rule or merged despite open `Important` findings, check two common pitfalls: (1) reading `REVIEW.md` or `.claude/` from the PR head instead of a branch-protected base/default branch (F16) (F20), and (2) adding `Claude Code Review` as a GitHub required check without parsing `bughunter-severity` / requiring thread resolution, since the check run concludes `neutral` rather than `failure` (F13) (F14).
- **Human oversight placement under high generation volume:** When generation outpaces human capacity, do not require two senior engineers on trivial docs/flagged PRs or allow an AI reviewer's approval to satisfy a human approval slot; instead, push deterministic checks and `/verify` pre-PR, route low-risk trusted-author changes through automated gates, reserve human approvals for high-blast-radius paths (`CODEOWNERS`), and monitor revert/incident rates as the safety guardrail (F5) (F29) (F30).

## Common mistakes

- **Adding `Claude Code Review` directly as a required GitHub status check:** Because the check run concludes `neutral` or `skipped` (never `failure`), a required check passes even with open 🔴 `Important` bugs; require conversation resolution or parse `bughunter-severity` (`normal > 0`) and `Code review not repeated` in CI (F13) (F14).
- **Treating a missing `bughunter-severity` comment as zero findings:** Failed, timed-out, canceled, or superseded runs omit the severity line; treat a missing line as **no verdict**, never as passing (F14).
- **Reading `REVIEW.md` or `.claude/` from the PR head:** A PR could weaken its own checks or inject malicious hooks/MCP servers; Code Review reads `REVIEW.md` from the protected base/default branch (F16), and `claude-code-action` restores `.claude/`, `.mcp.json`, and `CLAUDE.md` from the base/default branch while forbidding PR head checkouts on `pull_request_target` / `workflow_run` (F20).
- **Running `claude-code-security-review` automatically on fork PRs:** The action is not hardened against prompt injection and requires "Require approval for all external contributors" (F21).
- **Sharing the default `@claude` trigger across Code Review and `claude-code-action`:** `@claude review` fires both unless `claude-code-action` uses a custom `trigger_phrase` (F19).
- **Counting bot approvals as human approvals or accepting unverified claims:** Agent approvals never satisfy required human reviewers (F29), and agents without verification loops or required command output can pass narrow unit tests while breaking end-to-end behavior (F6) (F10).

## Self-check

1. **Why can adding `Claude Code Review` as a required GitHub check fail to block PRs with `Important` bugs, and what are the two documented ways to enforce merge gating?**
   - *Answer:* The `Claude Code Review` check run concludes `neutral` or `skipped` and never `failure` (F13). Enforce gating either by requiring GitHub conversation resolution before merging (since findings create unresolved threads) or by running a CI script that checks `output.title` for `Code review not repeated` and parses `<!-- bughunter-severity: ... -->` for `normal > 0`, failing if the severity line is missing (F14).
2. **During shadow-mode calibration of an AI reviewer, why does Anthropic evaluate recall separately at raw findings, post-verification, and final posted review, alongside a clean-PR control set?**
   - *Answer:* Scoring only end-to-end hides whether bugs were missed during discovery or dropped by an overly aggressive false-positive verification filter; pairing the incident/revert eval set with clean merged PRs measures over-flagging (false-positive rate) before enforcing merge gates (F25).
3. **Why do false-positive nits degrade throughput much faster when PR authors are AI agents rather than humans, and what controls restore convergence?**
   - *Answer:* Human authors dismiss nits in seconds, whereas agent authors fix every comment, pushing new commits that trigger additional review rounds and invalidate approvals (F27) (F29). Capping nit volume and excluding CI-enforced rules in `REVIEW.md` (F16), enforcing a 3-round review cap, switching to diff-only re-review after early passes, and suppressing duplicate findings restore convergence (F28).

## Unresolved

- **Internal risk-tier classifier implementation and voting quorum:** Anthropic's engineering posts describe a change-risk classifier (Low/Medium/High tiers) and multi-agent voting inside Code Review's verification stage (F12) (F29), but exact model prompts, quorum thresholds, and internal `Scion`/`Antique` tooling schemas are internal and not exposed as public configuration APIs.
- **Exact `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` default override behavior across non-interactive CI runners:** The hooks reference documents the 8-consecutive-continuation cap and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` environment variable (F7), while optimal CI timeout interactions depend on per-runner workflow limits.
