---
description: Fix C# build errors, Roslyn warnings, and NuGet issues incrementally. Invokes the csharp-build-resolver agent for minimal, surgical fixes.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# C# Build and Fix

This command invokes the **csharp-build-resolver** agent to incrementally fix C# build errors with minimal changes.

## What This Command Does

1. **Run Diagnostics**: Execute `dotnet build`, `dotnet format --verify-no-changes`
2. **Parse Errors**: Group by file and sort by severity
3. **Fix Incrementally**: One error at a time
4. **Verify Each Fix**: Re-run build after each change
5. **Report Summary**: Show what was fixed and what remains

## When to Use

Use `/csharp-build` when:
- `dotnet build` fails with errors
- Roslyn analyzer warnings need fixing
- NuGet package restore fails or versions conflict
- After pulling changes that break the build
- Nullable reference type warnings appear

## Diagnostic Commands Run

```bash
# Primary build check
dotnet build

# Verbose output
dotnet build -v detailed

# Package restore
dotnet restore

# Format check
dotnet format --verify-no-changes

# Vulnerable packages
dotnet list package --vulnerable
```

## Example Session

```text
User: /csharp-build

Agent:
# C# Build Resolution

## Initial Diagnostics

```bash
$ dotnet build
Features/Users/CreateUserHandler.cs(25,15): error CS0246: The type or namespace name 'Result' could not be found
Features/Users/GetUserQuery.cs(42,9): error CS8602: Dereference of a possibly null reference
Domain/ValueObjects/Email.cs(18,2): error CS0535: 'Email' does not implement interface member 'ValueObject.GetEqualityComponents()'
```

Errors found: 3

## Fix 1: Missing Using Directive

File: Features/Users/CreateUserHandler.cs:25
Error: CS0246 — 'Result' not found
Cause: Missing using directive

```csharp
// Added
using CSharpFunctionalExtensions;
```

```bash
$ dotnet build
# 2 errors remaining
```

## Fix 2: Nullable Dereference

File: Features/Users/GetUserQuery.cs:42
Error: CS8602 — Possible null dereference

```csharp
// Changed
var name = user.Profile.DisplayName;
// To
var name = user?.Profile?.DisplayName ?? "Unknown";
```

```bash
$ dotnet build
# 1 error remaining
```

## Fix 3: Missing Interface Member

File: Domain/ValueObjects/Email.cs:18
Error: CS0535 — Missing GetEqualityComponents

```csharp
// Added missing implementation
protected override IEnumerable<IComparable> GetEqualityComponents()
{
    yield return Value;
}
```

```bash
$ dotnet build
# Build succeeded!
```

## Final Verification

```bash
$ dotnet format --verify-no-changes
# No violations

$ dotnet test
Passed! - 42 tests passed
```

## Summary

| Metric | Count |
|--------|-------|
| Build errors fixed | 3 |
| Warnings fixed | 0 |
| Files modified | 3 |
| Remaining issues | 0 |

Build Status: SUCCESS
```

## Common Errors Fixed

| Error Code | Error | Typical Fix |
|-----------|-------|-------------|
| CS0246 | Type not found | Add using or NuGet package |
| CS1061 | Missing definition | Fix typo or add extension using |
| CS0029 | Type conversion | Fix return type or unwrap Result |
| CS0103 | Name not in scope | Declare variable or add using |
| CS8600-8604 | Nullable warnings | Add null check or use Maybe<T> |
| CS0311 | Generic constraint | Implement required interface |
| CS0535 | Interface not implemented | Add missing method |
| NU1605 | Package downgrade | Pin version or update |

## Fix Strategy

1. **Build errors first** — Code must compile
2. **Roslyn warnings second** — Fix analyzer issues
3. **Format violations third** — Style consistency
4. **One fix at a time** — Verify each change
5. **Minimal changes** — Don't refactor, just fix

## Stop Conditions

The agent will stop and report if:
- Same error persists after 3 attempts
- Fix introduces more errors
- Requires architectural changes
- Missing NuGet feed or package

## Related Commands

- `/csharp-test` — Run tests after build succeeds
- `/csharp-review` — Review code quality
- `/verify` — Full verification loop

## Related

- Agent: `agents/csharp-build-resolver.md`
- Skill: `skills/csharp-patterns/`
