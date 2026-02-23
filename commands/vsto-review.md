---
description: Combined VSTO review — COM safety (vsto-reviewer) + architecture enforcement (vsto-architecture-enforcer) in one pass. Use before committing VSTO add-in changes.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Task
---

# VSTO Review

This command invokes **two agents in parallel** for comprehensive VSTO code review:

1. **vsto-reviewer** — COM disposal, STA threading, RCW lifecycle, event handler safety
2. **vsto-architecture-enforcer** — Decorator chain ordering, lifecycle boundaries, handler conventions

## What This Command Does

### Pass 1: COM Safety (vsto-reviewer)
1. Identify changed `.cs` files via `git diff`
2. Scan for COM lifecycle violations (double-dot, foreach on collections, missing release)
3. Check STA threading compliance
4. Verify event handler subscribe/unsubscribe symmetry
5. Flag performance anti-patterns (Selection vs Range, missing ScreenUpdating)

### Pass 2: Architecture (vsto-architecture-enforcer)
1. Map changed files to VSTO layers (ThisAddIn, Ribbon, EventHandlers, Interop)
2. Verify lifecycle boundaries (no business logic in Ribbon, no COM in ThisAddIn)
3. Check decorator chain registration order
4. Verify handler naming, entitlement attributes, BDD coverage

### Combined Report
Merge both reports into a single review with unified severity ratings.

## When to Use

Use `/vsto-review` when:
- Before committing VSTO add-in changes
- After adding new command/query handlers
- After modifying DI registration or decorator chain
- After changing event handlers or Ribbon callbacks
- Reviewing pull requests with VSTO code

## Review Categories

### CRITICAL (Must Fix)
- Double-dot COM access (object leak)
- `foreach`/LINQ on COM collection
- COM access on background thread
- Business logic in ThisAddIn/Ribbon
- Decorator chain misordering (guards after expensive behaviors)
- `async void` in COM callback

### HIGH (Should Fix)
- Missing `[RequireEntitlement]` on handler
- COM reference stored in event handler field
- `Selection` instead of `Range`
- Missing ScreenUpdating toggle on bulk operations
- Domain logic in Interop layer
- Missing event unsubscribe

### MEDIUM (Consider)
- Performance decorator wrapping cross-cutting concerns
- Handler without matching `.feature` file
- Missing CancellationToken propagation
- Naming convention deviations

## Example Usage

```text
User: /vsto-review

Agent:
# VSTO Review Report

## Files Reviewed
- WordAddIn/Ribbon/MainRibbon.cs (modified)
- Core.Application/Features/Header/InsertHeaderHandler.cs (new)
- Core.Application/Features/Header/InsertHeaderCommand.cs (new)
- Infrastructure.Interop/WordDocumentEditor.cs (modified)

## COM Safety (vsto-reviewer)
✓ No double-dot violations
✓ STA threading compliant
✗ 1 issue found

[HIGH] Missing RCW release in finally block
File: Infrastructure.Interop/WordDocumentEditor.cs:42
Issue: Word.Range created but not released if exception occurs
Fix: Add try/finally with Marshal.ReleaseComObject

## Architecture (vsto-architecture-enforcer)

### Lifecycle Boundaries
- Ribbon: ✗ COM access in OnInsertHeaderClick

[CRITICAL] Business logic in Ribbon callback
File: WordAddIn/Ribbon/MainRibbon.cs:28
Issue: Direct COM manipulation — doc.Sections[1].Headers[...]
Fix: Dispatch InsertHeaderCommand instead

### Decorator Chain
✓ Correct order: Logging → DocumentContext → Licensing → DocumentRequired → Performance → Undo

### Handler Conventions
- InsertHeaderHandler: ✓ [RequireEntitlement] present
- InsertHeaderHandler: ✗ No matching .feature file
- InsertHeaderCommand: ✓ Naming convention

[HIGH] Missing BDD feature file
File: Core.Application/Features/Header/InsertHeaderHandler.cs
Issue: No InsertHeader.feature found
Fix: Create InsertHeader.feature with scenarios covering success + error paths

## Summary
- CRITICAL: 1 (Ribbon lifecycle violation)
- HIGH: 2 (Missing RCW release, missing feature file)
- MEDIUM: 0

Recommendation: Block merge until CRITICAL issue is fixed
```

## Approval Criteria

| Status | Condition |
|--------|-----------|
| Approve | No COM lifecycle or architecture violations |
| Warning | Minor convention issues only |
| Block | Any COM leak, lifecycle violation, decorator misordering, or missing entitlement |

## Integration with Other Commands

- Use `/csharp-test` to run tests after fixing issues
- Use `/csharp-build` if build errors occur
- Use `/csharp-review` for non-VSTO C# concerns (Result patterns, immutability)
- Use `/code-review` for general code quality

## Related

- Agents: `agents/vsto-reviewer.md`, `agents/vsto-architecture-enforcer.md`
- Skills: `skills/vsto-testing/`, `skills/office-document-patterns/`, `skills/vsto-smells/`, `skills/decorator-chain-patterns/`
