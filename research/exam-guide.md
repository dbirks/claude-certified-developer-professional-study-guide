# Official CCDV-P exam guide — extracted blueprint

- **Document:** Claude Certified Developer – Professional, Exam Guide
- **Version:** 1.0 · Effective November 2026 · Exam code CCDV-P (15 pages)
- **Retrieved:** 2026-11-19 from
  `https://cc.sj-cdn.net/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1794947325/Claude_Certified_Developer-Professional_Exam_Guide.pdf`
  (linked from the [Anthropic Partner Academy](https://anthropic-partners.skilljar.com/page/partner-certifications)).
- **Status:** verified against the primary source. The PDF itself is not redistributed in this repo.

## Exam facts (guide §4)

| Item | Value |
|---|---|
| Items | 70 (60 scored, 10 unscored and unidentified) |
| Format | Scenario-based multiple-choice and multiple-response; each item states how many to select |
| Time | 120 minutes |
| Delivery | Proctored (online and/or test center) via Pearson |
| Prerequisites | None; CCDV-Foundations recommended and its scope is assumed knowledge |
| Passing score | Scaled 720 on 100–1,000 |
| Fee | $175 USD |
| Validity | 12 months; free non-proctored renewal assessment if renewed on time |
| Score report | Pass/fail, scaled score, percent-correct by domain |

## Blueprint (guide §5) — 8 domains, 25 skills

Skill descriptions below are quoted from the guide, because they define exam scope.

### Domain 1 — Advanced Agent Architecture and Orchestration (17%)

| ID | Skill | Official description |
|---|---|---|
| 1.1 | Multi-Agent Orchestration | Evaluating orchestration patterns for production multi-agent designs and inter-agent failures, including supervisor/worker hierarchies, parallel subagent dispatch, delegation and context-isolation boundaries, inter-agent communication, and human-in-the-loop and approval flows. |
| 1.2 | Durable Execution and State Management | Applying session persistence, checkpointing, resumability, and memory architecture patterns to long-running agents that must survive interruption, restart, and model version change. |
| 1.3 | Architecture Selection at Scale | Evaluating production cost, reliability, and quality data to decide whether to evolve a running system between workflow and agentic patterns, and selecting the agent harness, framework, and reusable-pattern standards a team should adopt. |
| 1.4 | Context and Memory Architecture | Evaluating context-policy options for long-running agents approaching context limits or cost ceilings, including context compaction and editing, persistent memory, cache-safe instruction changes mid-conversation, and tool-use techniques that keep large tool catalogs out of the context window. |

### Domain 2 — Production Integration, Reliability, and Knowledge Grounding (20%)

| ID | Skill | Official description |
|---|---|---|
| 2.1 | Reliability Engineering for Claude Services | Evaluating and applying resilience patterns for production Claude integrations, including retry and backoff design, circuit breakers, graceful degradation, and cross-model, cross-region, and cross-platform fallbacks that distinguish rate limits from safety refusals from context-window stops while respecting per-platform feature parity. |
| 2.2 | Scale and Throughput Management | Analyzing rate-limit strategy, queueing and backpressure, batch pipeline design, multi-tenant quota and isolation, and capacity planning for high-volume Claude workloads, and identifying whether rate limits, token throughput, or batch economics is the binding constraint. |
| 2.3 | Production MCP and Change Management | Applying production MCP operation and change-management practice to MCP server deployments, model version migrations, and prompt updates, including remote MCP deployment and authentication, tool and schema versioning, migration testing against breaking behavior changes, platform-specific configuration parity and gateway/routing architectures, prompt versioning, and progressive rollout with rollback. |
| 2.4 | Retrieval and Knowledge Grounding at Scale | Evaluating retrieval architecture for knowledge-grounded production applications, including agentic search versus RAG tradeoffs, chunking and embedding strategy, hybrid search, and reranking, and designing grounding practices such as source citation, uncertainty declaration, and confidence signals, and diagnosing retrieval-quality failures by stage. |

### Domain 3 — Observability and Production Monitoring (12%)

| ID | Skill | Official description |
|---|---|---|
| 3.1 | Telemetry and Instrumentation | Applying instrumentation practice to production Claude systems under debuggability and privacy requirements, including distributed traces for agent loops and tool calls, token and cost metrics, cache-performance diagnostics, grounding and reasoning traceability, structured log events, and content-capture configuration under privacy constraints such as zero-data-retention. |
| 3.2 | Production Monitoring and Alerting | Analyzing production signals from LLM-backed services to define service level indicators (SLIs) and SLOs, design alerting and dashboards (including token and cost telemetry), and detect quality drift, behavioral regressions, and anomalous usage, including drift after model updates. |
| 3.3 | Trace Analysis at Scale | Analyzing high-volume trace data using sampling strategies, aggregation, and failure-cohort analysis to surface and quantify systemic issues that are not visible in individual traces. |

### Domain 4 — Advanced Debugging and Incident Response (10%)

| ID | Skill | Official description |
|---|---|---|
| 4.1 | Complex Failure Diagnosis | Analyzing evidence from complex production failures, including multi-turn, multi-agent, and non-deterministic failures, to isolate the problem origin among model output, agent harness, tools, and data, including model refusals as a failure class and retrieval-grounding failures. |
| 4.2 | Incident Response and Learning Loops | Evaluating incident-response options during an LLM-system outage or quality regression, including triage, mitigation, rollback, and communication, and converting the incident into regression evaluations, monitoring coverage, and postmortem findings. |

### Domain 5 — Evaluation Engineering and Quality Assurance (12%)

| ID | Skill | Official description |
|---|---|---|
| 5.1 | Evaluation System Design | Evaluating and designing offline evaluation systems for Claude applications, including golden sets, regression suites, behavioral checks, CI/CD evaluation gates, retrieval precision and groundedness metrics, and release criteria for prompt, model, and agent changes, and maintaining suite validity over time against contamination, saturation, and coverage gaps. |
| 5.2 | LLM-as-Judge Engineering | Analyzing LLM-as-judge evaluator quality against human-labeled data, including calibration, rubric design, bias and position effects, inter-rater reliability, and judge drift across model versions. |
| 5.3 | Online Quality Measurement | Analyzing quality on live production traffic using online evaluation techniques, including live-traffic sampling, A/B testing, feedback loops, and metric selection matched to task type (extraction, generation, agentic, retrieval-grounded). |

### Domain 6 — Cost and Latency Optimization at Scale (8%)

| ID | Skill | Official description |
|---|---|---|
| 6.1 | Cost Architecture at Scale | Evaluating fleet-level optimization strategies using usage and cost data, including cost modeling and forecasting, model routing and cascades across the Claude model family, caching strategy and cache diagnostics, batch-versus-realtime economics, and per-tenant budget enforcement. |
| 6.2 | Latency Engineering | Analyzing the latency profile of a Claude application against a latency target, distinguishing time-to-first-token from total latency, and applying streaming, parallel tool execution, cache checkpointing, and effort-level tuning. |

### Domain 7 — Runtime Guardrails and Production Security (11%)

| ID | Skill | Official description |
|---|---|---|
| 7.1 | Runtime Guardrail Systems | Evaluating layered guardrail architectures against a production agent's risk profile, including input/output filtering, PII redactors, hook-based policy enforcement, destructive-action prevention, sandboxing that grants tool and web access without exposing production systems, approval gates, refusal handling and safety fallbacks, deterministic enforcement for irreversible actions, and false-positive/false-negative tuning. |
| 7.2 | Threat Defense and Adversarial Testing for Agentic Systems | Analyzing the attack surface of tool-using agents that process untrusted content, including prompt injection, tool and memory poisoning, data exfiltration paths, unsafe-autonomy conditions, and the high-risk combination of private data access, untrusted input, and external communication, and applying defense-in-depth mitigations, red-team exercise design, and secure MCP configuration, drawing on the OWASP Top 10 for LLM Applications and the NIST AI Risk Management Framework and its Generative AI Profile. |
| 7.3 | Identity, Secrets, and Audit at Scale | Applying enterprise identity and secrets practice to production Claude deployments, including agent identity, workload identity federation replacing static API keys, credential and secrets management, least-privilege tool permissioning, and audit logging of security-relevant agent actions. |

### Domain 8 — Agent Fleet Operations for Software Delivery (10%)

| ID | Skill | Official description |
|---|---|---|
| 8.1 | Parallel Agent Orchestration for Engineering Work | Evaluating parallel fan-out patterns for large engineering tasks, including parallel agents on isolated worktrees, task decomposition, and merge and conflict strategy, and diagnosing fleet-level failure modes from fleet telemetry. |
| 8.2 | Verification and AI Code Review Operations | Analyzing verification operations in delivery pipelines where generation outpaces review, including AI code review introduced in shadow mode, calibration against human review before merge gating, and human oversight design. |
| 8.3 | Unattended and Event-Driven Agent Operations | Applying unattended-operation patterns to goal- or schedule-driven engineering tasks, including agents running toward goals, on schedules, or as event-driven responders such as CI/CD incident first response, with checkpointing, notification, and escalation design. |
| 8.4 | Organization-Wide Coding Agent Configuration | Applying enterprise configuration for organizations adopting coding agents, including managed settings and policies, MCP allowlists, telemetry, gateway routing, and governance with a quality and safety bar for sharing prompts, Skills, and MCP servers across teams. |

## Other guide content relevant to study

- §3 names the products the candidate is expected to use daily: Messages API, Agent SDK, **Claude Managed Agents**, Claude Code, MCP, and **first-party API vs cloud-platform deployment differences**.
- §6 "How to prepare" explicitly calls out Claude Code hooks, Skills, plugins and headless operation.
- §7 has three sample items (Domains 2, 5, 7). Their decision patterns: branch retry logic on stop condition; calibrate an LLM judge (randomize order, re-measure against human labels, withhold gating) before trusting it; enforce deterministic controls outside the model (recipient allowlist, approval, least-privilege scoping) for the "private data + untrusted input + external communication" combination.

## Differences from the provisional handoff map

- Guide is 15 pages; domain weights match the handoff exactly.
- Skill titles differ slightly (e.g. "Identity, Secrets, and Audit at Scale"; "Parallel Agent Orchestration for Engineering Work"). Site uses the official titles.
- New scope items not in the handoff: Claude Managed Agents; cross-region/cross-platform fallback with per-platform feature parity; agentic search vs RAG; content capture under zero-data-retention; drift after model updates; "lethal trifecta"-style combination (private data + untrusted input + external comms); NIST AI RMF **Generative AI Profile**; workload identity federation replacing static API keys; gateway routing for coding agents; "agents running toward goals".
