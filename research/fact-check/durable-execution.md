# Fact-check: 1.2 Durable Execution and State Management
Checked: 2026-11-19 · Reviewer: Gemini 4 Hydrogen

## Summary
- Claims checked: 64 cited claims across `F1`–`F34` plus all uncited factual/API/version statements in the chapter
- Supported as written: 48 · Fixed (partial/overstated/uncited): 16 · Removed: 2 meta-references ("that the packet marks runnable", "the packet records")
- Citations added: 15 (`F35`–`F49`), total 49 citations (`0` unused, `0` not-found)
- Code blocks checked: 2 Python blocks (`ast.parse` passed on both; SDK parameter names verified; recursion guard added to block 2)

## Changes
- Intro & File checkpointing — "checkpoints do not revert Bash writes" omitted that Bash edits to already-tracked files are undone → clarified to "files changed only by Bash", named `Write`/`Edit`/`NotebookEdit`, and cited `F12` on tool-edited files (`F11`, `F12`).
- What each state store covers — stated the harness manages file state automatically without noting Agent SDK opt-in, and implied the SDK journals nothing about tool calls → clarified Claude Code vs. opt-in Agent SDK checkpointing and that transcripts record tool calls/results rather than an external transaction log (`F1`, `F9`, `F11`, `F13`).
- Managed Agents compliance scope (What each state store covers, Decision criteria #6, Exam lens) — stated self-hosted Managed Agents is an exception for both ZDR and HIPAA BAA coverage → restricted the self-hosted exception to ZDR only, matching docs that mark all Managed Agents sub-features ineligible for HIPAA (`F15`, `F41`).
- Session options table — conflated `resume_session_at` and `resume_drops_turn` as aliases, omitted TypeScript `forkSession()`/`sessionStore`, and lacked citations for `resume_drops_turn`, `session_store_flush`, `append`/`load`, `fork_session()`, and 30-day default retention → split the two `resume_*` options accurately, added TS identifiers, and added verbatim citations (`F3`, `F6`, `F8`, `F29`, `F35`, `F36`, `F37`, `F38`, `F48`).
- File checkpointing and rewind — omitted required `extra_args={"replay-user-messages": None}` / `extraArgs: { "replay-user-messages": null }`, omitted `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=true` on the `claude -p --rewind-files` command, wrote "foreground-context fork skills", and cited `F14` for subagent tracking → added the required stream option and CLI env var, corrected wording to "a skill with `context: fork` running in the foreground", and added verbatim citations (`F13`, `F39`, `F40`, `F49`).
- Crash recovery for side effects — lead-in to Python block 1 included meta-text ("that the packet marks runnable") and incomplete stdlib list; `uncertain_completion` looked like a built-in constant; SSE `200` retry exception cited `F32` without quoting it → removed meta-text, listed omitted boilerplate and stdlib modules, clarified `uncertain_completion` as an application error payload, qualified `idempotentHint` retry advice with genuine-idempotency verification, and added `F46` (`F12`, `F32`, `F33`, `F46`).
- Memory architecture patterns — ZDR/HIPAA eligibility of `memory_20250818`, `100 kB`/`10,000` caps, and the `400` header conflict rule lacked dedicated verbatim quotes → added `F43`, `F44`, and `F47` (`F28`, `F30`, `F43`, `F44`, `F47`).
- Surviving a model version change — used "Google-managed Vertex AI" instead of `Claude Models on Google Cloud (Google managed)`, omitted the `in cases such as` qualifier on `claude --resume` model overrides, stated prefix mismatches always trigger `400` across all preserved-thinking models, lacked a quote for Managed Agents `tools`/`mcp_servers` mutability, had no guard against infinite recursion in `call_resumed_session`, and left "the packet records" in the version callout → aligned platform naming and resume exceptions, bolded **Preserved thinking**, distinguished guaranteed-`400` models from possible-`400` models, added `F42` and `F45`, guarded recursion on `not saved_state.get("prefix_mismatch_recovery")`, and reworded the callout (`F17`, `F21`, `F22`, `F24`, `F26`, `F42`, `F45`).
- Failure modes & Self-check — wrote "a run that completes goes `idle`" instead of "a session that completes its work goes `idle`", and stated `claude-sonnet-5-5` unconditionally returns `400` on prefix mismatch → corrected "run" to "session" (`F16`) and aligned Self-check #2 with `F45` (`F15`, `F16`, `F28`, `F43`, `F44`, `F45`).

## Remaining concerns
- Python worked example 1 (`DurableToolExecutor`) intentionally omits imports, SQLite `tool_steps` DDL, `StepOutcome`, `_mark`, and the custom exception classes for chapter brevity, so it parses cleanly (`ast.parse`) as a pattern sketch rather than executing standalone as printed; worked example 2 (`call_resumed_session`) is explicitly labeled pseudocode.
- `pnpm astro build --outDir .ccdvp-review-durable-execution/dist` failed during site-wide frontmatter parsing on an unrelated chapter (`content/03-observability/01-telemetry.mdx` line 3, missing closing `"` on `summary:`), which could not be edited under the file-scope constraint. `node scripts/check-citations.mjs durable-execution` (`OK`) and `node scripts/verify-quotes.mjs durable-execution` (`49 citations · ok 39 · ok-loose 10 · not-found 0`) both passed after the final edits.


## Second pass (GPT-6)

Checked: 2026-11-19 · Reviewer: GPT-6

### Summary

Reviewed all 49 pre-existing citation entries and the chapter's cited and uncited claims against their quotes and, where needed, current official sources. Four citations added (F50–F53); two Python blocks reviewed and removed in favor of a concrete recovery example and migration guidance. Claim totals by supported/fixed/removed were not separately tallied. The objective's session persistence, checkpointing, resumability, memory, interruption, restart, and model-change elements are covered; the exam lens remains editorial decision guidance.

### Changes

- Side-effect executor — transient failures could retry a non-idempotent call, concurrent workers could race, and retry exhaustion could misclassify an uncertain effect as terminal → replaced the incomplete code with a payment recovery scenario, atomic claim and provider-backed idempotency guidance (F9, F33).
- Migration example — matching diagnostic error text was brittle, and the pseudocode concealed the possible silent prefix mismatch → replaced it with targeted diagnostic and migration guidance (F45, F50).
- Model migration — implied changing models itself invalidates the thinking prefix and generalized the cold cache and prefix-check behavior → distinguished a model swap from prefix edits, scoped the cache claim to Claude Code and added the Message Batches exception (F23, F45, F53).
- Checkpoint recovery — omitted the resumed-session configuration and response-loop requirement → added both (F51).
- Memory versions — implied unlimited point-in-time recovery → stated the 30-day historical retention limitation (F30, F52).
- Recovery and deployment — narrowed interrupted-tool behavior to Claude Code, qualified ephemeral disk loss and memory-tool compliance eligibility, and clarified safe retries do not require an MCP hint (F9, F33, F43).
- Memory beta headers — clarified session endpoint behavior and corrected a citation interrupted by punctuation (F44).
- SSE errors — replaced the unsupported blanket SDK retry assertion with the documented limitation of standard error handling (F46).
- Verification — citation check OK; quote verifier 53 entries, zero not-found or fetch failures; isolated Astro build completed. There are no remaining fenced Python blocks to parse.

### Remaining concerns

- Claim-level supported, fixed, and removed counts were not recorded during this pass; the counts above describe reviewed citation entries and code blocks rather than a claim classification audit.
- Eligibility and beta behavior depend on deployment and current documentation; verify before production use.
