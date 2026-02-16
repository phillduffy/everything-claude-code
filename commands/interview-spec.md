---
description: Interview me to expand the spec
allowed-tools: AskUserQuestion, Read, Glob, Grep, Write, Edit
argument-hint: [spec-file]
---

## User Input

```text
$ARGUMENTS
```

You **MUST** use the spec file path from `$ARGUMENTS`. If empty, abort with instruction to provide path.

## Goal

Conduct a deep, challenging interview to expand and strengthen a feature specification. Go beyond surface-level questions—probe implications, challenge assumptions, force tradeoffs, and expose hidden complexity.

## Execution

### 1. Load or Initialize Spec

- Read the spec file at `$ARGUMENTS`
- If file doesn't exist, create minimal structure:
  ```markdown
  # Feature: [Name from path]

  ## Overview
  [To be defined through interview]

  ## Clarifications
  ### Session YYYY-MM-DD
  ```
- Parse existing content to understand current coverage

### 2. Coverage Scan

Analyze spec against this taxonomy. Mark each: **Clear** / **Partial** / **Missing**

| Category | What to Assess |
|----------|----------------|
| **Functional Scope** | Core goals, success criteria, explicit out-of-scope |
| **Domain & Data** | Entities, relationships, identity rules, state transitions, scale |
| **UX & Interaction** | User journeys, error/empty/loading states, accessibility |
| **Non-Functional** | Performance targets, scalability, reliability, observability, security |
| **Integration** | External dependencies, failure modes, protocols, versioning |
| **Edge Cases** | Negative scenarios, rate limiting, conflict resolution |
| **Constraints & Tradeoffs** | Technical constraints, rejected alternatives, explicit tradeoffs |
| **Terminology** | Canonical terms, avoided synonyms, glossary consistency |
| **Completion Signals** | Testable acceptance criteria, measurable DoD |

### 3. Generate Question Queue

Build prioritized queue using three question types:

**Gap-Filling** (Partial/Missing categories)
- Target unspecified areas
- Example: "What happens when [entity] reaches [limit]?"

**Implication-Probing** (Clear categories with hidden depth)
- Expose consequences of stated requirements
- Example: "You mentioned [X]—how does that interact with [Y]?"

**Challenge Questions** (All categories)
- **Devil's Advocate**: Question assumptions ("Why not use [alternative]?", "What if [dependency] fails?")
- **Scope Pushback**: Challenge complexity ("Is [feature] MVP or nice-to-have?", "Could [X] be deferred?")
- **Tradeoff Forcing**: Force decisions ("If you had to choose between [A] and [B], which wins?")

**Prioritization**: Impact × Uncertainty. Ensure category balance. Aim for mix of all question types.

### 4. Interview Loop (One Question at a Time)

For each question:

1. **Present with recommendation**
   - State the question clearly
   - Provide your **recommended answer** with 1-2 sentence reasoning
   - Format: `**Recommended:** [Option/Answer] — [reasoning]`

2. **For multiple choice** (2-5 options):
   ```
   | Option | Description |
   |--------|-------------|
   | A | ... |
   | B | ... |
   | Short | Provide different answer (≤5 words) |

   Reply with letter, "yes"/"recommended" to accept suggestion, or your own answer.
   ```

3. **For open-ended**:
   ```
   **Suggested:** [your answer] — [reasoning]
   Format: Short answer (≤5 words). Say "yes"/"suggested" to accept, or provide your own.
   ```

4. **After answer**:
   - Validate (disambiguate if unclear—doesn't count as new question)
   - Record in memory
   - Integrate immediately (see step 5)
   - Proceed to next question

**Stop when**:
- No critical gaps remain AND coverage is strong
- User signals: "done", "stop", "proceed", "good"
- Never reveal upcoming questions

### 5. Integrate After Each Answer

**Immediately after each accepted answer**:

1. Ensure `## Clarifications` section exists (create after Overview if missing)
2. Ensure `### Session YYYY-MM-DD` subheading exists for today
3. Append: `- Q: [question] → A: [answer]`
4. Update the most relevant section:
   - Functional → Functional Requirements
   - Data/Domain → Data Model
   - NFR → Non-Functional Requirements (convert vague to measurable)
   - Edge case → Edge Cases section
   - Terminology → Normalize across doc
5. **Replace** any now-invalid statements (no contradictory text)
6. **Save immediately** after each integration

### 6. Validation (After Each Write)

- [ ] One bullet per answer in Clarifications
- [ ] Updated sections have no vague placeholders the answer resolved
- [ ] No contradictory earlier statements remain
- [ ] Markdown structure valid
- [ ] Terminology consistent across sections

### 7. Completion Report

Output:

```
## Interview Complete

**Questions asked**: N
**Spec updated**: [path]

### Sections Modified
- [list of section names]

### Coverage Summary

| Category | Status |
|----------|--------|
| Functional Scope | Clear/Resolved/Deferred/Outstanding |
| Domain & Data | ... |
| UX & Interaction | ... |
| Non-Functional | ... |
| Integration | ... |
| Edge Cases | ... |
| Constraints | ... |
| Terminology | ... |
| Completion Signals | ... |

### Outstanding Items
[List any Deferred/Outstanding with rationale]

### Suggested Next Step
[Recommend next action based on coverage]
```

## Behavior Rules

- **Non-obvious only**: Skip questions answerable from reading the spec
- **Challenge actively**: Include devil's advocate, scope pushback, tradeoff questions
- **Probe implications**: Don't just fill gaps—explore consequences of stated requirements
- **Adapt dynamically**: Let previous answers influence next questions
- **One at a time**: Never batch questions; wait for answer before next
- **Always recommend**: Every question gets a suggested answer with reasoning
- **Save incrementally**: Write after each answer, not at end
- **Respect signals**: Stop on "done", "stop", "proceed"
- **No tech speculation**: Avoid stack questions unless blocking functional clarity
