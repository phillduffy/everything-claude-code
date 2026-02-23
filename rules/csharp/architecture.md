---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Architecture Rules

> This file extends [common/patterns.md](../common/patterns.md) with C# architecture enforcement.

## Anti-Corruption Layer (CRITICAL)

External types must NOT appear in Domain or Application layers:
- `Microsoft.Office.Interop.*` — only in Interop/Infrastructure
- External SDK types (iManage, Stripe, etc.) — only in Infrastructure adapters
- Domain defines interfaces; Infrastructure implements and translates

## Vertical Slice Organization

Group by feature, not by technical layer:
- `Features/{Name}/{Name}Command.cs` + `{Name}Handler.cs`
- Shared infra in `Common/` or `Infrastructure/`
- Cross-cutting via decorators, not per-feature duplication
- Smell: `Services/` or `Repositories/` folders with 10+ files

## Dependency Direction

Source code dependencies point inward only:

```
Presentation → Infrastructure → Application → Domain
```

- Domain references nothing
- Application references Domain only
- Infrastructure references Application + Domain
- Presentation references all (but delegates immediately)

## Interface Ownership

Interfaces that Infrastructure implements MUST be defined in Application or Domain — never in Infrastructure itself.

## ADR Tracking

One-way-door decisions require an ADR in `docs/adr/`:
- Aggregate boundaries, public API contracts, framework choices
- Template: See CSHARP_CONSTITUTION.md Appendix A
- Never delete ADRs — supersede with a new one referencing the old

## Reference

See agent: `csharp-architecture-enforcer` for automated verification.
See CSHARP_CONSTITUTION.md §4 for full rationale.
