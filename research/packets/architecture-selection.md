# 1.3 Architecture Selection at Scale

> Evaluating production cost, reliability, and quality data to decide whether to evolve a running system between workflow and agentic patterns, and selecting the agent harness, framework, and reusable-pattern standards a team should adopt.

## Scope map

- Evaluating production cost, reliability, and quality data → Core facts; Practitioner reasoning; Worked example.
- Deciding whether to evolve a running system between workflow and agentic patterns → Practitioner reasoning and Worked example, including both directions.
- Selecting the agent harness, framework, and reusable-pattern standards a team should adopt → Core facts, Exact API / config details, and Practitioner reasoning.

## Core facts

- A workflow orchestrates LLMs and tools through predefined code paths; an agent dynamically directs its own process and tool use. These describe control flow, not whether a product's marketing uses the word “agent.” (F1, F2)
- Anthropic recommends the simplest solution that meets the need, potentially a single optimized call rather than an agent. Workflows offer predictability for defined tasks; agents offer flexibility where model-directed decisions are needed. More autonomy often exchanges cost and latency for task performance. (F3, F4, F5)
- Frameworks simplify integration but abstraction can hide prompts and responses and complicate debugging. (F6)
- Anthropic reports multi-agent suitability for valuable, parallelizable tasks, large information volumes, and many complex tools; highly dependent or shared-context work can be a poor fit. Its research-system observations were about 4× tokens for an agent and 15× for multi-agent relative to **chat**, not 15× relative to a single agent and not a general pricing rule. (F7, F8, F9)
- Claude Agent SDK embeds the Claude Code agent in a Python or TypeScript process the developer operates. Claude Code headless provides non-interactive execution through the CLI. (F10, F18)
- The Messages API SDK tool runner executes the tool loop and handles errors and typing; its default state includes the conversation history. Anthropic recommends a manual loop where human approval, custom logging, or conditional tool execution is needed. (F11, F12)
- Claude Managed Agents is a beta harness and infrastructure for autonomous agents. The hosted service maintains retrievable event history. A cloud environment supplies a separate isolated container per session; a self-hosted sandbox uses a worker on customer infrastructure, but tool results still reach the managed service. Self-hosting the entire service is a separate option. (F13, F14, F15, F16, F17, F30)
- Claude Code Skills are reusable project instructions; project subagent definitions can be checked into version control. PreToolUse hooks run after tool arguments are generated and before the tool call; they can allow, deny, ask, or defer. (F20, F21, F22, F23)
- Define measurable success criteria and use evaluations; most applications require multiple dimensions rather than a single score. (F24, F25)

## Exact API / config details

- Python Messages SDK beta runner: `@beta_tool` defines a typed, documented tool; `client.beta.messages.tool_runner(...)` accepts `max_iterations` to bound the loop. The runner normally appends assistant messages and tool results to its history; do not mistake this in-process history for a hosted durable session. (F26, F27, F12)
- Managed Agents beta requests require the `managed-agents-2026-04-01` beta header. The distinction between an agent definition, environment, and session is essential to capacity and hosting choices; per-session event history is service-managed in the hosted offering. (F28, F13, F14, F15)
- Claude Code: `claude -p "..." --output-format json` runs non-interactively and yields structured JSON including the result, session ID, and metadata. The `--print` spelling is equivalent to `-p`. (F18, F19)
- Claude Code project Skills use `.claude/skills/<skill-name>/SKILL.md`; project subagent definitions reside under `.claude/agents/` and consist of YAML frontmatter followed by a Markdown system prompt. These paths and conventions are Claude Code configuration, not a guarantee that every third-party framework discovers them. (F20, F21, F29)
- `PreToolUse` is an event, not a substitute for controlling the underlying credential or service. Hook decision control can allow, deny, ask, or defer a tool call. (F22, F23)
- Exact Agent SDK package versions, a specific third-party framework's persistence and isolation guarantees, and portability of every Skill frontmatter field have not been pinned here; verify the implementation and current version before deployment.

## Practitioner reasoning

### Measure the running system

[INFERENCE] Define the unit as one accepted user task, assign a stable task ID across retries, tool calls and human handoffs, and freeze the success rubric and observation window before comparing arms. Record all attempts, including abandoned, timed-out, escalated, and failed tasks. Report success both as overall completed-and-correct / eligible tasks and by task cohort; track severity, factuality, policy adherence, and human correction where relevant. Validate a sample with independent human labels and measure grader agreement; an apparently successful answer may be wrong.

[INFERENCE] Compute **cost per successful task = total fully loaded cost of all eligible attempts / number of successful tasks**. Include model input/output, cache reads/writes, tool and infrastructure charges, retries, parallel subagents, grading, and operational or human intervention where material. Also report cost per attempted task and absolute spend: a lower per-success cost can coincide with unacceptable error rates or higher total spend. If zero tasks succeed, the ratio is undefined; report zero successes and the total cost. Do not multiply an average request cost by a success rate without accounting for failed attempts.

[INFERENCE] Track end-to-end p50/p95 completion time, timeout and deadline-miss rates, and separately time to first output for interactive clients. Instrument per-tool attempts, error type, retry count, timeouts, and latency; distinguish tool-call failure rate (failed calls / calls) from task-level impact (tasks affected / eligible tasks). Break down by tool, model, tenant, and input complexity. Correlate loop length and tokens with failures. A tool dependency outage calls for fixing or isolating the dependency before attributing failure to architecture.

[INFERENCE] Compare on matched or randomized traffic, with the same rubric, risk controls, tool access, deadline, and budget; account for confidence intervals, rare high-severity failures, and selection bias. Shadow runs with side effects disabled estimate quality but do not demonstrate real execution reliability. Introduce holdouts and canaries, monitor cohort-level guardrails, and retain a rapid rollback path. The most accurate option is not automatically the best when reliability, budget, safety, or deadline requirements fail.

### Migration decision matrix

[INFERENCE] Assumptions: equivalent authorized tools and data; measured on representative traffic under the same completion definition; all choices must meet safety and privacy requirements. Hosting, isolation and persistent-session guarantees must be evaluated for the particular product and deployment. A harness choice is independent of the degree of model control: an SDK can implement bounded workflows too.

| Observed condition / constraint | Candidate | Why and what must be checked |
|---|---|---|
| Stable paths, known steps, low variance, deadline tight | Fixed workflow or one augmented call | Deterministic orchestration limits calls and branching; verify task-quality threshold and explicit failure handling. |
| Unknown steps or repeated workflow exceptions, evidence of recoverable tool choices | Bounded single agent | Dynamic selection can recover diverse cases; compare incremental successful outcomes against cost, tool errors and tail latency. |
| Independent, high-value research branches exceeding one context | Multi-agent | Parallel independent exploration may improve coverage; measure duplicate work, aggregation failures, and full token cost. Avoid for strongly dependent shared-state work. |
| Precise application control; limited tool catalog | Messages API manual loop or tool runner | Runner handles normal loop; manual control suits approval, conditional execution and bespoke logging. Application owns execution environment and durable state. (F11, F12) |
| Custom product needs Claude Code tools, permissions, hooks, sessions | Agent SDK | Embed the harness in a process the team operates; explicitly provision hosting, storage, isolation, and policy. (F10) |
| Unattended repository/CI task | Claude Code `-p` | CLI integrates with scripts and session metadata; provide a controlled execution environment and machine-readable result. (F18, F19) |
| Long-running async work and reduced infrastructure burden | Managed Agents | Hosted service and cloud sandbox reduce runtime ownership; assess data handling, beta availability, network policy, and session economics. Self-hosted sandbox and self-hosted service are distinct deployment choices. (F13, F14, F15, F16, F17, F30) |
| Existing third-party framework solves required orchestration or integration | Evaluate that framework | Verify raw Claude request visibility, tool semantics, permission boundaries, observability, session durability, supported models and hosting against the actual release; test upgrade and exit costs. (F6) |

[INFERENCE] Move workflow → agent when the known decision tree fails on a material cohort and a controlled trial shows enough incremental successful tasks within cost, tail latency and tool-safety limits. Prefer routing only that cohort to a bounded agent when regular cases already work. Move agent → workflow when traces show a stable repeated tool sequence or quality and latency targets can be met with fewer calls; prove the simpler path on exceptions, preserve escalation and compare real outcomes. Revert or constrain autonomy if loop churn, tool failures, unsafe side effects, or tail latency rise, even if average answer quality improves.

### Reusable standards

[INFERENCE] Treat shared patterns as versioned engineering assets with an owner, purpose, supported runtime, input/output contract, allowed tools, risk classification, example use, evaluation cases, change log and rollback. Store reusable instructions as Skills; use subagents for isolated roles with explicit scope, permitted tools, return format and handoff requirements; keep authenticated integration code and typed schemas in reviewed shared tool libraries. Hooks supply repeatable lifecycle checks and policy integration. Test tools independently with timeout and retry semantics, idempotency and least privilege; do not duplicate OAuth secrets in prompts. Put irreversible-action authorization in a trusted service as well as any agent hook. Validate actual discovery and precedence for each runtime before claiming portability. (F20, F21, F22, F23, F29)

## Worked example(s)

[INFERENCE] Original hypothetical, not a benchmark: an OAuth-protected ticket-triage service handles 10,000 eligible tasks per arm in a randomized production trial. Each arm has the same tool permissions, evaluator and escalation policy; costs include every attempt, tool execution, retries and human review. Success means correct resolution within 90 seconds without policy breach. The cohorts and measurement period are assumed comparable.

| Metric | Fixed workflow | Bounded single agent |
|---|---:|---:|
| Eligible tasks | 10,000 | 10,000 |
| Successful tasks | 8,000 (80%) | 9,200 (92%) |
| Total cost | $4,000 | $5,060 |
| Cost / attempted task | $0.40 | $0.506 |
| Cost / successful task | $0.50 | $0.55 |
| End-to-end p95 | 35 s | 70 s |
| Failed tool calls / total calls | 400 / 20,000 = 2% | 1,200 / 60,000 = 2% |
| Tasks with at least one failed tool call | 380 (3.8%) | 1,050 (10.5%) |

The agent adds 1,200 successful tasks for $1,060 extra per 10,000 attempts: **$0.883 per incremental success**, and raises cost per success from $0.50 to $0.55. The tool-call failure rate is unchanged, but three times as many tool calls expose more tasks to failure; it is not evidence the dependency became less reliable. Suppose the business requires at least 90% success, p95 under 80 seconds, no severe policy regression and values incremental success at $2.00: the bounded agent is a candidate despite costing more per success. A human-reviewed quality sample, statistical uncertainty, separate severity rates, and a successful canary are still required before broad rollout. If the 2,000 difficult tasks account for most gains, test a router and its missed-exception rate before committing all traffic to the agent. If later trace data shows a fixed sequence now resolves those cases within the same thresholds for less, migrate that cohort back to a workflow.

The example is arithmetic only; no SDK code is presented or implied to be runnable.

## Diagram spec

Type: flow. Nodes: eligible task → cohort/router → fixed workflow or bounded agent → tools → outcome and cost telemetry → evaluation against thresholds → canary / rollback decision. Edges: route cases; execute tool calls; collect success, cost, latency and errors; feed results into both migration directions. Caption: “Use comparable production outcomes to decide where dynamic control earns its cost.”

## Exam lens

- Editorial inference: a scenario may require weighting verified completion and cost per successful task against latency and tool failures, rather than selecting the architecture with the lowest per-request price.
- Editorial inference: identify whether variable paths require model decisions, or whether stable repeated paths justify replacing an agent with a workflow.
- Editorial inference: distinguish an embedded harness, a tool loop, a headless CLI, and a hosted managed service; check who operates execution and session state.
- Editorial inference: choose independently testable shared Skills, subagents, tools and hooks with deterministic enforcement for consequential actions.

## Common mistakes

- Calling a fixed orchestration an autonomous agent merely because it uses tools, or assuming a framework choice determines the control-flow pattern. (F1, F2)
- Comparing only successful-run cost, excluding retries or escalations, or treating equal per-call error rates as equal task-level reliability. [INFERENCE]
- Applying the research team's 15×-versus-chat observation as a universal 15×-versus-single-agent multiplier. (F8)
- Assuming a self-hosted Managed Agents sandbox keeps model inputs and tool results on the customer's infrastructure, or confusing that option with self-hosting the whole service. (F16, F17, F30)
- Assuming instructions alone enforce permissions, or assuming a local hook intercepts every possible data path. [INFERENCE]

## Self-check

1. A workflow succeeds 8,000 times for $4,000; an agent succeeds 9,200 times for $5,060 on 10,000 attempts each. Which has lower cost per success? **Workflow: $0.50 versus $0.55; the agent adds 1,200 successes at $0.883 each.**
2. A tool fails on 2% of calls in both arms but the agent makes three times as many calls. Are equal task-level failure rates implied? **No; measure affected tasks and recovery separately.**
3. Does a self-hosted sandbox mean the entire Managed Agents service is self-hosted? **No; a worker can execute tools locally while the managed service receives tool results; self-hosting the service is a separate option.** (F16, F17, F30)

## Unresolved

- No standalone Anthropic page titled “When to use multi-agent systems” was verified; the official research-system article supplies applicable guidance. (F7, F9)
- The quote verifier's direct network access is restricted in this environment. Some URLs are available in an existing cache; remaining pages were read through web fetch but may report `fetch-failed` in the script. See the final verification output.
- Product and framework capabilities evolve; pricing and exact per-framework deployment guarantees require a fresh comparison for the specific release and platform.
