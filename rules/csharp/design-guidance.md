---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Design Guidance

> Principles that guide judgment calls. Not automatable — applied during review.

## Ubiquitous Language (§8.3)

Code names should match terms the business uses:
- `document.ApplyNumbering()` not `document.SetFlag(FlagType.Numbered, true)`
- `template.PromoteToPrecedent()` not `template.UpdateType(2)`
- Avoid: Manager, Helper, Util, Processor, Data, Info in class names

## Rule of Three (§6.4)

Wait for 3 instances before abstracting:
- 1st occurrence: just write it
- 2nd occurrence: note it, copy is fine
- 3rd occurrence: extract IF same concept AND same reason to change
- "The wrong abstraction is far more costly than duplication" — Sandi Metz

## Prefer Boring Technology (§6.6)

~3 innovation tokens per project. Approved boring stack:
- SQL Server, xUnit v3, NSubstitute, System.Text.Json, CSharpFunctionalExtensions
- New dependencies: require brief justification or ADR for non-trivial additions

## YAGNI Reminders (§6.3)

- Interface with 1 implementation "just in case" → remove until needed
- Configuration supporting 10 providers when 1 is used → simplify
- Abstract factory for a single type → direct construction
- Exception: DI/testability interfaces with 1 impl ARE acceptable

## Reference

See agent: `csharp-reviewer` for review application of these principles.
See CSHARP_CONSTITUTION.md §6 and §8 for full rationale.
