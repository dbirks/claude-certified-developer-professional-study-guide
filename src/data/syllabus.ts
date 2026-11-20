// Official CCDV-P blueprint (Exam Guide v1.0, effective November 2026). See research/exam-guide.md.
// Titles and objectives are quoted from the guide. Slugs are stable URL segments: never rename them.

export type Priority = 'fire' | 'target' | 'none';

export interface Skill {
  id: string; // "2.1"
  slug: string; // URL segment and content/citation file stem
  title: string;
  short: string; // compact title for pager cards and tight UI
  objective: string;
  priority: Priority; // personal study priority from the handoff, not official emphasis
}

export interface Domain {
  n: number;
  slug: string;
  title: string;
  weight: number; // percent of scored items
  skills: Skill[];
}

export const GUIDE = {
  name: 'Claude Certified Developer – Professional',
  code: 'CCDV-P',
  version: '1.0',
  effective: 'November 2026',
  verified: '2026-11-19',
};

export const DOMAINS: Domain[] = [
  {
    n: 1,
    slug: 'agent-architecture',
    title: 'Advanced Agent Architecture and Orchestration',
    weight: 17,
    skills: [
      { id: '1.1', short: 'Multi-Agent Orchestration', slug: 'multi-agent-orchestration', title: 'Multi-Agent Orchestration', priority: 'none', objective: 'Evaluating orchestration patterns for production multi-agent designs and inter-agent failures, including supervisor/worker hierarchies, parallel subagent dispatch, delegation and context-isolation boundaries, inter-agent communication, and human-in-the-loop and approval flows.' },
      { id: '1.2', short: 'Durable Execution', slug: 'durable-execution', title: 'Durable Execution and State Management', priority: 'fire', objective: 'Applying session persistence, checkpointing, resumability, and memory architecture patterns to long-running agents that must survive interruption, restart, and model version change.' },
      { id: '1.3', short: 'Architecture Selection', slug: 'architecture-selection', title: 'Architecture Selection at Scale', priority: 'none', objective: 'Evaluating production cost, reliability, and quality data to decide whether to evolve a running system between workflow and agentic patterns, and selecting the agent harness, framework, and reusable-pattern standards a team should adopt.' },
      { id: '1.4', short: 'Context and Memory', slug: 'context-memory', title: 'Context and Memory Architecture', priority: 'target', objective: 'Evaluating context-policy options for long-running agents approaching context limits or cost ceilings, including context compaction and editing, persistent memory, cache-safe instruction changes mid-conversation, and tool-use techniques that keep large tool catalogs out of the context window.' },
    ],
  },
  {
    n: 2,
    slug: 'production-integration',
    title: 'Production Integration, Reliability, and Knowledge Grounding',
    weight: 20,
    skills: [
      { id: '2.1', short: 'Reliability', slug: 'reliability', title: 'Reliability Engineering for Claude Services', priority: 'target', objective: 'Evaluating and applying resilience patterns for production Claude integrations, including retry and backoff design, circuit breakers, graceful degradation, and cross-model, cross-region, and cross-platform fallbacks that distinguish rate limits from safety refusals from context-window stops while respecting per-platform feature parity.' },
      { id: '2.2', short: 'Scale and Throughput', slug: 'scale-throughput', title: 'Scale and Throughput Management', priority: 'fire', objective: 'Analyzing rate-limit strategy, queueing and backpressure, batch pipeline design, multi-tenant quota and isolation, and capacity planning for high-volume Claude workloads, and identifying whether rate limits, token throughput, or batch economics is the binding constraint.' },
      { id: '2.3', short: 'MCP and Change Management', slug: 'mcp-change-management', title: 'Production MCP and Change Management', priority: 'none', objective: 'Applying production MCP operation and change-management practice to MCP server deployments, model version migrations, and prompt updates, including remote MCP deployment and authentication, tool and schema versioning, migration testing against breaking behavior changes, platform-specific configuration parity and gateway/routing architectures, prompt versioning, and progressive rollout with rollback.' },
      { id: '2.4', short: 'Retrieval and Grounding', slug: 'retrieval-grounding', title: 'Retrieval and Knowledge Grounding at Scale', priority: 'target', objective: 'Evaluating retrieval architecture for knowledge-grounded production applications, including agentic search versus RAG tradeoffs, chunking and embedding strategy, hybrid search, and reranking, and designing grounding practices such as source citation, uncertainty declaration, and confidence signals, and diagnosing retrieval-quality failures by stage.' },
    ],
  },
  {
    n: 3,
    slug: 'observability',
    title: 'Observability and Production Monitoring',
    weight: 12,
    skills: [
      { id: '3.1', short: 'Telemetry', slug: 'telemetry', title: 'Telemetry and Instrumentation', priority: 'fire', objective: 'Applying instrumentation practice to production Claude systems under debuggability and privacy requirements, including distributed traces for agent loops and tool calls, token and cost metrics, cache-performance diagnostics, grounding and reasoning traceability, structured log events, and content-capture configuration under privacy constraints such as zero-data-retention.' },
      { id: '3.2', short: 'Monitoring and Alerting', slug: 'monitoring-alerting', title: 'Production Monitoring and Alerting', priority: 'fire', objective: 'Analyzing production signals from LLM-backed services to define service level indicators (SLIs) and SLOs, design alerting and dashboards (including token and cost telemetry), and detect quality drift, behavioral regressions, and anomalous usage, including drift after model updates.' },
      { id: '3.3', short: 'Trace Analysis', slug: 'trace-analysis', title: 'Trace Analysis at Scale', priority: 'fire', objective: 'Analyzing high-volume trace data using sampling strategies, aggregation, and failure-cohort analysis to surface and quantify systemic issues that are not visible in individual traces.' },
    ],
  },
  {
    n: 4,
    slug: 'debugging',
    title: 'Advanced Debugging and Incident Response',
    weight: 10,
    skills: [
      { id: '4.1', short: 'Failure Diagnosis', slug: 'failure-diagnosis', title: 'Complex Failure Diagnosis', priority: 'fire', objective: 'Analyzing evidence from complex production failures, including multi-turn, multi-agent, and non-deterministic failures, to isolate the problem origin among model output, agent harness, tools, and data, including model refusals as a failure class and retrieval-grounding failures.' },
      { id: '4.2', short: 'Incident Response', slug: 'incident-response', title: 'Incident Response and Learning Loops', priority: 'fire', objective: 'Evaluating incident-response options during an LLM-system outage or quality regression, including triage, mitigation, rollback, and communication, and converting the incident into regression evaluations, monitoring coverage, and postmortem findings.' },
    ],
  },
  {
    n: 5,
    slug: 'evaluation',
    title: 'Evaluation Engineering and Quality Assurance',
    weight: 12,
    skills: [
      { id: '5.1', short: 'Evaluation Design', slug: 'evaluation-design', title: 'Evaluation System Design', priority: 'fire', objective: 'Evaluating and designing offline evaluation systems for Claude applications, including golden sets, regression suites, behavioral checks, CI/CD evaluation gates, retrieval precision and groundedness metrics, and release criteria for prompt, model, and agent changes, and maintaining suite validity over time against contamination, saturation, and coverage gaps.' },
      { id: '5.2', short: 'LLM-as-Judge', slug: 'llm-as-judge', title: 'LLM-as-Judge Engineering', priority: 'fire', objective: 'Analyzing LLM-as-judge evaluator quality against human-labeled data, including calibration, rubric design, bias and position effects, inter-rater reliability, and judge drift across model versions.' },
      { id: '5.3', short: 'Online Quality', slug: 'online-quality', title: 'Online Quality Measurement', priority: 'fire', objective: 'Analyzing quality on live production traffic using online evaluation techniques, including live-traffic sampling, A/B testing, feedback loops, and metric selection matched to task type (extraction, generation, agentic, retrieval-grounded).' },
    ],
  },
  {
    n: 6,
    slug: 'cost-latency',
    title: 'Cost and Latency Optimization at Scale',
    weight: 8,
    skills: [
      { id: '6.1', short: 'Cost Architecture', slug: 'cost-architecture', title: 'Cost Architecture at Scale', priority: 'target', objective: 'Evaluating fleet-level optimization strategies using usage and cost data, including cost modeling and forecasting, model routing and cascades across the Claude model family, caching strategy and cache diagnostics, batch-versus-realtime economics, and per-tenant budget enforcement.' },
      { id: '6.2', short: 'Latency Engineering', slug: 'latency-engineering', title: 'Latency Engineering', priority: 'target', objective: 'Analyzing the latency profile of a Claude application against a latency target, distinguishing time-to-first-token from total latency, and applying streaming, parallel tool execution, cache checkpointing, and effort-level tuning.' },
    ],
  },
  {
    n: 7,
    slug: 'security',
    title: 'Runtime Guardrails and Production Security',
    weight: 11,
    skills: [
      { id: '7.1', short: 'Runtime Guardrails', slug: 'runtime-guardrails', title: 'Runtime Guardrail Systems', priority: 'none', objective: 'Evaluating layered guardrail architectures against a production agent’s risk profile, including input/output filtering, PII redactors, hook-based policy enforcement, destructive-action prevention, sandboxing that grants tool and web access without exposing production systems, approval gates, refusal handling and safety fallbacks, deterministic enforcement for irreversible actions, and false-positive/false-negative tuning.' },
      { id: '7.2', short: 'Threat Defense', slug: 'threat-defense', title: 'Threat Defense and Adversarial Testing for Agentic Systems', priority: 'none', objective: 'Analyzing the attack surface of tool-using agents that process untrusted content, including prompt injection, tool and memory poisoning, data exfiltration paths, unsafe-autonomy conditions, and the high-risk combination of private data access, untrusted input, and external communication, and applying defense-in-depth mitigations, red-team exercise design, and secure MCP configuration, drawing on the OWASP Top 10 for LLM Applications and the NIST AI Risk Management Framework and its Generative AI Profile.' },
      { id: '7.3', short: 'Identity, Secrets, Audit', slug: 'identity-secrets-audit', title: 'Identity, Secrets, and Audit at Scale', priority: 'none', objective: 'Applying enterprise identity and secrets practice to production Claude deployments, including agent identity, workload identity federation replacing static API keys, credential and secrets management, least-privilege tool permissioning, and audit logging of security-relevant agent actions.' },
    ],
  },
  {
    n: 8,
    slug: 'agent-fleets',
    title: 'Agent Fleet Operations for Software Delivery',
    weight: 10,
    skills: [
      { id: '8.1', short: 'Parallel Agents', slug: 'parallel-agents', title: 'Parallel Agent Orchestration for Engineering Work', priority: 'fire', objective: 'Evaluating parallel fan-out patterns for large engineering tasks, including parallel agents on isolated worktrees, task decomposition, and merge and conflict strategy, and diagnosing fleet-level failure modes from fleet telemetry.' },
      { id: '8.2', short: 'Verification and Review', slug: 'verification-review', title: 'Verification and AI Code Review Operations', priority: 'fire', objective: 'Analyzing verification operations in delivery pipelines where generation outpaces review, including AI code review introduced in shadow mode, calibration against human review before merge gating, and human oversight design.' },
      { id: '8.3', short: 'Unattended Operations', slug: 'unattended-operations', title: 'Unattended and Event-Driven Agent Operations', priority: 'fire', objective: 'Applying unattended-operation patterns to goal- or schedule-driven engineering tasks, including agents running toward goals, on schedules, or as event-driven responders such as CI/CD incident first response, with checkpointing, notification, and escalation design.' },
      { id: '8.4', short: 'Org-Wide Configuration', slug: 'org-configuration', title: 'Organization-Wide Coding Agent Configuration', priority: 'fire', objective: 'Applying enterprise configuration for organizations adopting coding agents, including managed settings and policies, MCP allowlists, telemetry, gateway routing, and governance with a quality and safety bar for sharing prompts, Skills, and MCP servers across teams.' },
    ],
  },
];

export function findSkill(id: string): { domain: Domain; skill: Skill } | undefined {
  for (const domain of DOMAINS) {
    const skill = domain.skills.find((s) => s.id === id);
    if (skill) return { domain, skill };
  }
  return undefined;
}
