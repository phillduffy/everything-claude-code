---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Code Smells

> This file extends [common/coding-style.md](../common/coding-style.md) with code smell enforcement.

## Always-On Enforcement

When writing or reviewing C# code, detect and resolve these code smells. These are structural problems — not style preferences — and must be addressed before merge.

## Severity

| Level | Action | Smells |
|-------|--------|--------|
| **CRITICAL** | Block | Primitive Obsession, Feature Envy, Shotgun Surgery, Duplicate Code, Divergent Change |
| **HIGH** | Block | Long Method (>25 lines), Large Class (>250 lines), Long Parameter List (>4), Data Clumps, Switch Statements (duplicated), Data Class (anemic entity), Dead Code, Interface Bloat (ISP), Partial Functions |
| **MEDIUM** | Warn | Comments (explaining what, not why), Lazy Class, Middle Man, Speculative Generality, Temporary Field, Message Chains, Refused Bequest, Inappropriate Intimacy, Alternative Classes, Parallel Inheritance, Incomplete Library Class |

## Key Fixes

- **Primitive Obsession** → `ValueObject` with `Create()` returning `Result<T, Error>`
- **Feature Envy** → Move method to the class whose data it accesses
- **Long Method** → Extract method, guard clauses, Result chaining
- **Large Class** → Vertical slices, extract value objects
- **Long Parameter List** → Parameter object as `record`
- **Data Clumps** → Extract `ValueObject` or `record`
- **Switch Statements** → Pattern matching (single), polymorphism (duplicated)
- **Data Class** → Add behavior (Tell Don't Ask), or convert to `record` if truly a DTO
- **Dead Code** → Delete. Git is the backup.
- **Duplicate Code** → Extract method, extension method, or shared service
- **Interface Bloat (ISP)** → Split into role-specific interfaces (Reader/Writer/Finder)
- **Partial Functions** → `TryParse` + `Maybe<T>`, `.FirstOrDefault()` + Maybe, guard divisor
- **Speculative Generality** → Also detect: 1-impl interfaces (not for DI), empty abstract classes, unused generics
- **Refused Bequest** → Also detect: `NotSupportedException` in interface impls (Liskov violation — interface too broad)
- **Switch Statements** → Also flag: same switch/if-else on same discriminator in 2+ files — strategy pattern needed

## Sealed by Default

All public classes should be `sealed` unless explicitly designed for inheritance:
- `sealed` enables compiler/JIT optimizations and prevents unintended extension
- Analyzer CA1852 can enforce this — classes that are never inherited should be sealed
- Exceptions: base classes with documented extension points, abstract classes

## Pragmatic Exceptions

- Constructor injection up to 6 params is acceptable
- Single `switch` expression dispatches are fine — smell is duplicated switches
- `record` DTOs/commands/queries are NOT data class smells
- XML doc comments on public APIs are NOT comment smells
- Interfaces for DI/mocking are acceptable with 1 implementation
- LINQ fluent chains are NOT message chains

## Reference

See skill: `csharp-smells` for the complete 25-smell catalog with detection heuristics and C# fix patterns.
