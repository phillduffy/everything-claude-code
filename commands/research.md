---
name: research
description: Research a technical decision. Evaluates libraries, compares approaches, or makes build-vs-buy recommendations.
argument-hint: "[topic] - What to research"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Task
  - WebSearch
  - WebFetch
---

# Technical Research Command

On-demand technical research using the issue-specialist agent (research mode).

## Process

1. **Understand the need** from argument:
   - Library evaluation: "validation library for .NET"
   - Approach comparison: "caching strategies"
   - Build vs buy: "should I use X or build custom"

2. **Launch issue-specialist agent** to:
   - Identify candidates
   - Evaluate health metrics
   - Compare features
   - Assess total cost of ownership

3. **Output recommendation with rationale**

## Examples

```
/research validation library for .NET
/research caching: Redis vs in-memory
/research should we use Polly for retries
/research build vs buy for email templating
```

## Output

- Candidates evaluated
- Comparison matrix
- Recommendation with rationale
- Risks and mitigations
- Exit strategy
