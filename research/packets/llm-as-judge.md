# 5.2 LLM-as-Judge Engineering

Official objective (November 2026 exam guide):

> Analyzing LLM-as-judge evaluator quality against human-labeled data, including calibration, rubric design, bias and position effects, inter-rater reliability, and judge drift across model versions.

## Scope map

- Analyzing LLM-as-judge evaluator quality against human-labeled data → **Core facts**, **Practitioner reasoning (Error analysis, FP/FN trade-offs, and release-gate criteria)**, **Worked example(s)**.
- Calibration → **Core facts**, **Practitioner reasoning (Human-labeled calibration loop)**, **Worked example(s)**.
- Rubric design → **Core facts**, **Exact API / config details**, **Practitioner reasoning (Grading mode and rubric design)**.
- Bias and position effects → **Core facts**, **Practitioner reasoning (Bias taxonomy and order swapping)**, **Worked example(s)**.
- Inter-rater reliability → **Core facts**, **Practitioner reasoning (Cohen's $\kappa$ and Krippendorff's $\alpha$)**.
- Judge drift across model versions → **Core facts**, **Exact API / config details**, **Practitioner reasoning (Judge drift and snapshot pinning)**.

## Core facts

- Anthropic recommends choosing the fastest, most reliable, most scalable grading method: prefer code-based checks where rules suffice, avoid relying on slow/expensive human grading at scale, and test LLM-based graders for reliability before scaling. (F1, F2, F3)
- Grading recurs on every evaluation run in perpetuity (unlike fixed dataset authoring cost), making per-run grader cost and speed central design constraints. (F7)
- Anthropic's LLM-grading guidance calls for detailed, explicit rubrics (multiple rubrics when a criterion needs holistic decomposition), empirical discrete outputs (`correct`/`incorrect` or `1–5` scales) over qualitative prose, and enabling thinking in the grader model so it reasons before scoring. (F4, F5, F6)
- *Demystifying evals for AI agents* stresses iterative calibration of model graders against human experts until divergence is small, after which human review can drop to occasional spot-checks; systematic human studies should be reserved for calibrating LLM judges or subjective tasks. (F9, F11, F15)
- To curb hallucinated verdicts and criterion conflation, give the judge an escape hatch (e.g., `"Unknown"` when evidence is insufficient) and score each dimension with an isolated LLM-as-judge rather than one holistic multi-dimension judge. (F10)
- Ambiguous task specs and vague rubrics turn spec ambiguity into metric noise; two domain experts should independently reach the same verdict. (F12)
- Never trust aggregate eval scores at face value: test candidate model graders empirically and read trial transcripts alongside grades to separate real system failures from buggy or unfair graders. (F8, F13, F16)
- Balance evaluation datasets with both positive and negative cases (where a behavior should and should not fire) to avoid one-sided optimization. (F14)
- Zheng et al. (2023) distinguish pairwise comparison (scales quadratically $O(n^2)$ across $n$ candidates) from single-answer pointwise grading (scales linearly, but loses subtle discrimination and fluctuates more when the judge model changes). (F27)
- Strong frontier LLM judges exceeded 80% agreement with humans on MT-Bench and Chatbot Arena—matching human-to-human agreement—once biases were addressed: position bias (favoring a prompt slot), verbosity bias (preferring longer padded answers), and self-enhancement / self-preference bias (favoring outputs from the judge's own model/family). (F28, F30, F31, F32)
- Conservative order swapping runs each pairwise judge call in both `(A, B)` and `(B, A)` orders, declaring a win only when both agree and scoring flips as ties. (F29)
- Cohen's $\kappa$ measures chance-corrected agreement between two raters classifying $N$ items into $C$ mutually exclusive categories (`-1` to `1`; scores `> 0.8` generally indicate good agreement, `<= 0` no better than chance). (F33, F34)
- Krippendorff's $\alpha$ supports any number of coders, incomplete/missing data, small samples, and nominal, ordinal, interval, or ratio scales; social-science norms treat $\alpha \ge 0.800$ as reliable, $0.667 \le \alpha < 0.800$ as tentative only, and raise the threshold with decision stakes. (F35, F36, F37)
- From Claude 4.6 onward, dateless canonical IDs (`claude-opus-5-5`, `claude-sonnet-4-6`) are pinned immutable snapshots, whereas pre-4.6 dateless strings (`claude-sonnet-4-5`) are moving aliases resolving to the latest dated snapshot (`-YYYYMMDD`). Even on pinned IDs, serving-infrastructure updates can introduce minor drift. (F17, F18, F19)

## Exact API / config details

### Native thinking vs. `reasoning_extraction` refusals

- **Avoid `<thinking>` tags and `reasoning` JSON keys:** Legacy cookbook prompts asked for `<thinking></thinking>` XML tags, but current docs warn that prompting Claude to emit its internal thinking or step-by-step reasoning in response text—or in JSON schema properties named `reasoning`, `thinking`, or `trace`—triggers `stop_reason: "refusal"` with `stop_details.category: "reasoning_extraction"`. (F22)
- **No fallback model for `reasoning_extraction`:** This refusal category has no server-side fallback; revise the prompt/schema to ask for a brief explanation or cited evidence and use native thinking blocks instead. (F23)
- **Thinking display and budgets:** On Claude 5+ models, adaptive thinking (`thinking: {"type": "adaptive"}` or omitted) is on by default, while `display` defaults to `"omitted"` (empty `thinking` string plus encrypted `signature`). Pass `thinking: {"type": "adaptive", "display": "summarized"}` during calibration audits to inspect judge reasoning summaries. Thinking tokens count toward `max_tokens` and output billing; SDKs require `.stream()` for `max_tokens > 21333`. (F6, F23, F24)

### Structured judge outputs (`output_config.format`) and effort

- **Constrained decoding + thinking:** Use `client.messages.parse(..., output_format=PydanticModel)` in Python or `zodOutputFormat(...)` in TypeScript (`output_config.format` with `type: "json_schema"`). Grammars constrain only the final JSON output, not `thinking` blocks, letting Claude reason freely before emitting valid JSON. (F20)
- **Case-insensitive enum checks:** Structured outputs do not guarantee exact string casing on `enum` or `const` values (especially after spaces); normalize `.strip().lower()` when reading judge labels. (F21)
- **Citations conflict:** Combining `citations: {"enabled": true}` with `output_config.format` returns HTTP `400`; for groundedness judges, embed source chunks in the prompt and extract plain-text `evidence_summary` fields in JSON. (F20)
- **Effort tuning:** Steer judge reasoning depth via `output_config: {"effort": "low" | "medium" | "high" | "xhigh" | "max"}` (`medium` is default on `claude-opus-5-5`/`claude-haiku-5-5`; `high` on `claude-sonnet-5-5`/`claude-fable-5-2`). (F25)

### Snapshot pinning and batch grading

- **Pin across platforms:** On Claude API use 4.6+ canonical IDs (`claude-opus-5-5`) or pre-4.6 dated IDs (`claude-sonnet-4-5-20250929`, never `claude-sonnet-4-5`). On Bedrock use `anthropic.claude-{name}-{major}[-{minor}]` (with `global.`/`us.` prefix for cross-region profiles, or `-YYYYMMDD-v1:0` pre-4.6); on Google Cloud Google-managed pre-4.6 use `@{YYYYMMDD}`. (F17, F18)
- **Message Batches API:** Run offline calibration, order-swapped pairwise sweeps, and regression evals through `/v1/messages/batches` for a **50% cost discount** (up to **100,000 requests** or **256 MB** per batch; typically `< 1 hour`, 24-hour SLA, 29-day result retention). (F26)

## Practitioner reasoning

### 1. Grading mode and rubric design

- **Pointwise vs. pairwise vs. reference-guided:** [INFERENCE] Use **pointwise** grading for CI/CD regression gates and SLA tracking because cost scales $O(k)$ and absolute pass/fail rates are comparable across builds (provided the judge is pinned). Use **pairwise** comparison for subtle A/B preference tests (tone, synthesis), limiting scope to targeted pairs to avoid $O(n^2)$ blowup. Add **reference-guided** golden answers or tool outputs for math, reasoning, and factual checks so the judge verifies against ground truth rather than parametric memory. (F12, F27)
- **Observable rubrics and isolated dimensions:** [INFERENCE] Replace subjective adjectives with checkable conditions and auto-fail rules so two SMEs agree without conferring. Split multi-aspect tasks into separate isolated judges (one per dimension, mixing code graders for deterministic checks with Claude judges for semantic checks) to prevent halo effects and masked regressions. Always include an `"unknown"` verdict so truncated or ambiguous transcripts do not force hallucinated passes/fails. (F1, F4, F10, F12)

### 2. Bias taxonomy and position-effect mitigations

- **Position and name bias:** Pairwise judges favor Slot 1 (and certain labels like `"Assistant A"`), especially on close pairs and open-ended writing/humanities tasks. (F28)
  - *Bidirectional order swapping:* Run `(A, B)` and `(B, A)`; accept a win only when consistent across both orders and score flips as `tie` (or escalate to human review). Offset the 2x token cost with Batch API's 50% discount. (F26, F29)
  - *Large-scale randomization:* [INFERENCE] For massive sweeps, randomly assign A/B to Slot 1/2 across items so net slot bias cancels in expectation, while still running bidirectional swaps on the calibration subset to quantify flip rate. (F29)
- **Verbosity and self-preference bias:** Judges reward padded, repetitive outputs over concise ones (verbosity bias) and can favor their own model family's style (self-enhancement bias). [INFERENCE] Add explicit conciseness penalties and length-adversarial test cases; avoid judging Candidate Model X vs. Y solely with Model X, or verify parity against human labels per model family. (F14, F30, F31)

### 3. Human calibration and Inter-Rater Reliability (IRR)

- **Calibration loop:** [INFERENCE] (1) Curate a stratified, balanced calibration set (100–200 items spanning positive, negative/trap, and edge cohorts). (2) Collect independent labels from $\ge 2$ SMEs and reconcile disagreements first—if human-human IRR is `< 0.80`, fix the rubric before tuning the judge. (3) Run the pinned judge and compute human-vs-judge IRR plus confusion-matrix metrics. (4) Read transcripts of every disagreement to diagnose rubric gaps vs. harness truncation vs. bias, iterate, and re-measure on a held-out validation slice before gating. (F9, F12, F13, F15)
- **Cohen's $\kappa$ vs. Krippendorff's $\alpha$:**
  - Use **Cohen's $\kappa$** for two raters on complete categorical ratings (`pass`/`fail` or `A`/`B`/`tie`). Beware the *prevalence paradox*: high class imbalance (e.g., 95% pass) inflates chance agreement $p_e$ and depresses $\kappa$ despite high raw agreement—always pair $\kappa$ with minority-class precision/recall. (F33, F34)
  - Use **Krippendorff's $\alpha$** for $\ge 3$ raters (e.g., two SMEs + Claude judge), missing/partial overlap, or ordinal/interval scales (`1–5` rubrics, penalizing `1` vs. `5` more than `4` vs. `5`). Target $\alpha \ge 0.800$ for automated gating; treat `0.667–0.799` as advisory only; reject `< 0.667`. (F35, F36, F37)

### 4. Confidence, error analysis, FP/FN trade-offs, and drift control

- **Operationalizing judge confidence:** [INFERENCE] Because the Messages API does not expose calibrated token logprobs, measure confidence via **swap consistency** (agreed vs. flipped), **self-consistency** across $k$ samples, **`"unknown"` abstention**, and **empirical calibration curves** mapping discrete confidence tiers to observed human accuracy. Route low-confidence or flipped items to human review. (F10, F29)
- **FP vs. FN trade-offs:** [INFERENCE] Align rubric strictness with asymmetric error cost: in safety/groundedness defect detectors (defect = positive), minimize false negatives so bad outputs do not ship, accepting higher human-triage false positives; in quality release gates (pass = positive), a lenient judge (high false-pass rate) ships regressions while an overly strict judge (high false-fail rate) blocks valid releases. Balanced positive/negative slices expose skew immediately. (F14)
- **Judge drift across versions:** Pin the judge snapshot ID, prompt, schema, `thinking`, and `effort` as one versioned artifact (never use pre-4.6 moving aliases). Periodically re-score a frozen human-labeled **anchor set** to catch subtle serving-infrastructure drift, and run side-by-side anchor calibration before promoting any new Claude judge version. (F17, F18, F19)
- **Two-stage release gates:** [INFERENCE] Gate **evaluator readiness** first (withhold CI/CD blocking authority until held-out $\kappa/\alpha \ge 0.80$, swap consistency $\ge 85\%$, slot bias $|\Delta| < 2$ pp, and FP/FN bounds pass), then enforce **application release gates** (near-100% pass on calibrated regression suites plus production monitoring under the Swiss Cheese Model). (F15, F16)

## Worked example(s)

### Worked Example 1: Position bias inflating win rate and fixed calibration procedure (Official Sample Item 2)

**Scenario (illustrative, aligned with Official Sample Item 2 in guide §7).** A team compares `Candidate B` against `Baseline A` on 100 support queries using an uncalibrated pairwise judge, always placing `Candidate B` in Slot 1. The unswapped run reports **68 B wins, 20 A wins, 12 ties**—an apparent **68% win rate** (77.3% excluding ties). Before enabling CI/CD merge gating, the engineer audits the judge against a 100-item human-labeled golden set ($\kappa_{\text{human}} = 0.84$: **44 B wins, 40 A wins, 16 ties**).

**Bidirectional swap audit:**
- `(B, A)` order: 68 B wins, 20 A wins, 12 ties.
- `(A, B)` order: 36 B wins, 52 A wins, 12 ties.
- Combined swap matrix: **34 consistent B wins**, **18 consistent A wins**, **10 consistent ties**, and **38 position-flipped pairs** (62% swap consistency; Slot 1 won regardless of content on 34 pairs).

First-position bias inflated Candidate B's apparent win rate by **+24 percentage points** (`68%` raw vs. `44%` human truth), yielding only **58% raw agreement** and **$\kappa = 0.34$** against human labels.

**Fixed procedure:**
1. **Withhold CI/CD gating** until calibration passes (never gate releases on $\kappa = 0.34$). (F2, F9)
2. **Enforce bidirectional order swapping** (`(A, B)` and `(B, A)`), converting swap-flipped pairs to `tie` (or routing to human/tiebreaker review), or randomize slot placement on large sweeps. (F29)
3. **Decompose rubric + enable thinking:** Replace the holistic prompt with isolated dimension rubrics (grounding, policy compliance, conciseness penalty against verbosity bias), enable native thinking (`display="summarized"` for audit), and add `"unknown"`. (F4, F6, F10, F30)
4. **Re-measure on held-out human labels:** After calibration, swap consistency rises from `62%` to `91%`, human-judge **$\kappa = 0.82$** (and 3-rater **Krippendorff's $\alpha = 0.83$**), and Candidate B records **45 wins, 39 losses, 16 ties**—matching ground truth (`44 / 40 / 16`)—qualifying the judge for release gating. (F34, F37)

### Worked Example 2: Pointwise + Pairwise Claude Judge Harness (Python, runnable-shape)

*Illustrative runnable-shape Python targeting current `anthropic` SDK (`messages.parse`, `output_config`, `thinking`) with pinned snapshot `claude-opus-5-5`.*

```python
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field
from anthropic import Anthropic

JUDGE_MODEL = "claude-opus-5-5"  # Pinned 4.6+ canonical snapshot

class Verdict(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    UNKNOWN = "unknown"  # Escape hatch when evidence is missing/ambiguous

class GroundednessGrade(BaseModel):
    # Request brief evidence—NOT "thinking" or "reasoning" fields—to avoid reasoning_extraction refusals.
    evidence_summary: str = Field(description="1-2 sentence citation of supporting or contradicting facts.")
    verdict: Verdict

def grade_groundedness(client: Anthropic, source_context: str, candidate_answer: str) -> GroundednessGrade:
    prompt = (
        "Grade whether <answer> is fully supported by <context>. "
        "Return 'fail' if any claim contradicts or goes beyond <context>. "
        "Return 'unknown' if <context> is truncated or ambiguous.\n\n"
        f"<context>{source_context}</context>\n<answer>{candidate_answer}</answer>"
    )
    resp = client.messages.parse(
        model=JUDGE_MODEL,
        max_tokens=2048,
        thinking={"type": "adaptive", "display": "summarized"},
        output_config={"effort": "medium"},
        messages=[{"role": "user", "content": prompt}],
        output_format=GroundednessGrade,
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError(f"Judge refused ({resp.stop_details})")
    parsed = resp.parsed_output
    parsed.verdict = Verdict(parsed.verdict.value.strip().lower())  # Defensive enum normalization
    return parsed

class PairwiseChoice(BaseModel):
    brief_justification: str
    winner: Literal["first", "second", "tie", "unknown"]

def pairwise_swapped(client: Anthropic, question: str, ans_a: str, ans_b: str) -> str:
    def run_once(first: str, second: str) -> str:
        r = client.messages.parse(
            model=JUDGE_MODEL,
            max_tokens=2048,
            thinking={"type": "adaptive", "display": "omitted"},
            output_config={"effort": "medium"},
            messages=[{
                "role": "user",
                "content": (
                    "Compare Response 1 and Response 2 solely on factual accuracy and conciseness. "
                    "Do not reward extra length unless factual detail differs.\n"
                    f"<question>{question}</question>\n"
                    f"<response_1>{first}</response_1>\n<response_2>{second}</response_2>"
                ),
            }],
            output_format=PairwiseChoice,
        )
        return r.parsed_output.winner.strip().lower()

    v_ab, v_ba = run_once(ans_a, ans_b), run_once(ans_b, ans_a)
    if v_ab == "unknown" or v_ba == "unknown":
        return "unknown"
    if v_ab == "first" and v_ba == "second":
        return "A"
    if v_ab == "second" and v_ba == "first":
        return "B"
    return "tie"  # Conservative swap-inconsistency -> tie (Zheng et al., 2023)
```

## Diagram spec

**Type:** flow.
**Nodes/edges:** `Balanced human calibration set` → `Human-human IRR check (kappa/alpha >= 0.80)` → (fail) `Fix rubric & task spec` → loop; (pass) `Run pinned Claude judge (adaptive thinking + JSON schema)` → (if pairwise) `Run (A,B) and (B,A) swapped orders` → `Consistent?` → (no: `Tie or human review`, yes: `Record verdict`) → `Compute human-judge IRR + FP/FN confusion matrix` → `Inspect disagreement transcripts` → `Calibration gate passed?` → (no: `Withhold CI/CD gating & refine rubric`, yes: `Enable release gate + periodic anchor drift check`).
**Caption:** Validate evaluator IRR, order-swap consistency, and error-rate bounds against human labels before granting an LLM judge release-gating authority.

## Exam lens

*(Editorial inference based on the November 2026 official exam guide; Official Sample Item 2 in guide §7 tests calibrating an LLM judge before trusting it.)*

1. **[EDITORIAL INFERENCE] Withholding gating until order-swapping and human recalibration pass (Official Sample Item 2):** When a pairwise judge shows a large win-rate jump with one model always placed first or after rubric changes, reject immediate rollout/gating; randomize or swap presentation order, re-measure agreement against human labels, and withhold release gating until calibrated.
2. **[EDITORIAL INFERENCE] Fixing `reasoning_extraction` refusals in structured judges:** Adding `<thinking>` tags or `"reasoning"` JSON fields to `output_config.format` triggers `stop_reason: "refusal"` (`reasoning_extraction`, no fallback model); switch to native adaptive thinking (`display: "summarized"` for audits) and a brief `evidence_summary` field.
3. **[EDITORIAL INFERENCE] Selecting IRR metrics and diagnosing prevalence paradox:** Choose Krippendorff's $\alpha$ (not Cohen's $\kappa$) for $\ge 3$ raters, missing ratings, or ordinal 1–5 scales; when raw agreement is high (94%) yet $\kappa$ is low (`0.35`), diagnose class imbalance and evaluate minority-class precision/recall on balanced sets.
4. **[EDITORIAL INFERENCE] Separating judge drift from app regressions:** Sudden eval drops without app changes signal a moving pre-4.6 alias (`claude-sonnet-4-5`), unpinned judge upgrade, or serving-infra drift—verify on the frozen human-labeled anchor set before changing the application.

## Common mistakes

- Trusting raw unswapped pairwise win rates when one candidate consistently occupies Slot 1. (F28, F29)
- Putting `"reasoning"` or `"thinking"` fields inside `output_config.format` schemas, triggering `reasoning_extraction` refusals. (F22, F23)
- Relying on raw percent agreement instead of chance-corrected $\kappa$/$\alpha$ on class-imbalanced suites. (F33, F34)
- Using pre-4.6 moving aliases (`claude-sonnet-4-5`) or uncalibrated model upgrades in longitudinal judge pipelines. (F18, F19)
- Scoring five criteria in one blended judge call instead of isolating dimensions and preferring deterministic code checks where possible. (F1, F10)
- Iterating judge prompts without reading disagreement transcripts, missing harness truncation or spec ambiguity. (F13, F16)

## Self-check

1. **Q:** Upgrading your regression judge from `claude-sonnet-4-5` to `claude-opus-5-5` drops app pass rates from 91% to 82% with no app changes. What should you do first?
   **A:** Withhold blaming or rolling back the app. Pin snapshot IDs, run both judges side by side on your frozen human-labeled anchor set, inspect disagreement transcripts, and re-measure human-judge IRR ($\kappa$/$\alpha$) and FP/FN bias before promoting the new judge.
2. **Q:** Why did adding `"reasoning": {"type": "string"}` to a structured judge schema trigger `stop_reason: "refusal"`, and how do you keep reason-first accuracy?
   **A:** Requesting internal reasoning in output JSON triggers `reasoning_extraction` (which has no fallback model). Remove the field, rely on native adaptive thinking (`display: "summarized"` for audits), and request a brief `"evidence_summary"` string.
3. **Q:** You have 300 transcripts scored 1–5 by two SMEs (with 20% missing overlap) plus a Claude judge. Which IRR metric applies and what threshold justifies automated gating?
   **A:** Use ordinal **Krippendorff's $\alpha$** (Cohen's $\kappa$ handles only two raters with complete overlap), targeting $\alpha \ge 0.800$ before enabling automated gating (`0.667–0.799` is tentative only).

## Unresolved

- **Exact verbatim wording of Official Sample Item 2:** The exam guide PDF (`Claude_Certified_Developer-Professional_Exam_Guide.pdf`) could not be text-extracted verbatim here because `pdftotext` and Python PDF libraries were unavailable; this packet relies on the verified summary in `research/exam-guide.md` §7.
- **Anthropic-prescribed numeric IRR cutoffs:** Anthropic docs mandate close human calibration (F9) and standard external reliability practices, but do not publish a single universal $\kappa$ or $\alpha$ gate number; numeric gate values (`>= 0.80`) come from standard statistical references (F34, F37) and risk-based `[INFERENCE]`.
