---
name: csharp-smells
description: C# code smell detection and resolution based on refactoring.guru catalog. This skill should be used when the user asks to "find code smells", "check for smells", "refactor smells", "review code quality", "detect design problems", "clean up this code", "what's wrong with this code", "anemic domain model", or when reviewing C# code for structural issues. Covers Bloaters, OO Abusers, Change Preventers, Dispensables, and Couplers with C#-specific fix patterns.
---

# C# Code Smell Detection & Resolution

To detect and resolve code smells in C# codebases, apply the refactoring.guru catalog adapted for modern C# idioms (records, pattern matching, Result/Maybe, ValueObject).

## Severity Classification

| Severity | Smells | Action |
|----------|--------|--------|
| **CRITICAL** | Primitive Obsession, Feature Envy, Shotgun Surgery, Duplicate Code, Divergent Change | Block merge |
| **HIGH** | Long Method, Large Class, Long Parameter List, Data Clumps, Switch Statements, Data Class, Dead Code | Block merge |
| **MEDIUM** | Comments, Lazy Class, Middle Man, Speculative Generality, Temporary Field, Message Chains, Refused Bequest, Inappropriate Intimacy, Alternative Classes, Parallel Inheritance, Incomplete Library Class | Warn, merge with caution |

## Pragmatic Thresholds

| Metric | Threshold | Notes |
|--------|-----------|-------|
| Method length | >25 lines | Excluding braces, blank lines |
| Class length | >250 lines | Excluding using statements |
| Parameter count | >4 params | Constructor injection exempt if <7 |
| Nesting depth | >3 levels | Already enforced by reviewer |
| Duplicate blocks | >5 lines | Identical or near-identical |

## Detection Workflow

1. Identify target files: run `git diff -- '*.cs'` for changed files, or scan specific directories/files as requested
2. For each target file, scan for smell indicators
3. Cross-reference with adjacent files for coupling smells (Shotgun Surgery, Feature Envy)
4. Classify each smell by severity
5. Provide specific fix with code example

## CRITICAL Smells — Quick Reference

### Primitive Obsession
**Detect**: `string email`, `int userId`, `decimal amount` in method signatures or domain models.
**Fix**: Extract `ValueObject` with `Create()` returning `Result<T, Error>`. See `csharp-patterns` skill.

### Feature Envy
**Detect**: Method accessing 3+ properties/methods of another class more than its own.
**Fix**: Move method to the envied class, or extract the accessed data into a parameter.

### Shotgun Surgery
**Detect**: A single logical change requires edits across 3+ files that aren't part of the same vertical slice.
**Fix**: Consolidate into a single vertical slice. Extract shared behavior into a service.

### Duplicate Code
**Detect**: 5+ identical or near-identical lines in multiple locations.
**Fix**: Extract method, extract base record, or extract shared service. For Result chains, create extension methods.

### Divergent Change
**Detect**: A class modified for 2+ unrelated reasons (e.g., handles both user creation AND email sending).
**Fix**: Split by responsibility. Each class should have one reason to change.

## HIGH Smells — Quick Reference

### Long Method (>25 lines)
**Fix**: Extract method, use guard clauses for early returns, leverage LINQ for collection operations.

### Large Class (>250 lines)
**Fix**: Extract value objects, split into vertical slices, separate concerns into focused services.

### Long Parameter List (>4 params)
**Fix**: Introduce parameter object as `record`. Use `IOptions<T>` for configuration.

```csharp
// Bad: 6 parameters
public Result<Order, Error> CreateOrder(string email, string name, string address, string city, string zip, string country)

// Good: Parameter object
public record CreateOrderCommand(Email Email, Name Name, Address ShippingAddress);
public Result<Order, Error> CreateOrder(CreateOrderCommand command)
```

### Data Clumps
**Detect**: Same 3+ fields appearing together across multiple classes/methods (e.g., street, city, zip).
**Fix**: Extract `ValueObject` or `record` to group them.

### Switch Statements
**Detect**: `switch`/`if-else` chains on type or enum with 3+ cases, especially if duplicated.
**Fix**: Use C# pattern matching for simple cases. For complex cases, use polymorphism or strategy pattern.

```csharp
// Acceptable: Simple pattern matching
return status switch
{
    OrderStatus.Active => HandleActive(order),
    OrderStatus.Cancelled => HandleCancelled(order),
    _ => Result.Failure<Order, Error>(DomainErrors.Order.InvalidStatus)
};

// Smell: Same switch duplicated in multiple methods → use polymorphism
```

### Data Class
**Detect**: Class with only properties and no behavior methods.
**Fix**: If it's a DTO/command/query, convert to `record`. If it's a domain entity, add behavior methods (Tell Don't Ask).

### Dead Code
**Detect**: Unused methods, unreachable branches, commented-out code, unused parameters.
**Fix**: Delete it. Version control is the backup.

## MEDIUM Smells — Quick Reference

| Smell | Detect | Fix |
|-------|--------|-----|
| **Comments** | Comments explaining *what* code does | Rename, extract method to make intent obvious |
| **Lazy Class** | Class with <3 methods and 1 field | Inline into caller or merge with related class |
| **Middle Man** | Class delegating >50% of methods | Remove wrapper, inject dependency directly |
| **Speculative Generality** | Abstract class with 1 implementation, unused params | Remove abstraction until 2+ implementations exist |
| **Temporary Field** | Field only set in certain code paths | Extract into separate class or use `Maybe<T>` |
| **Message Chains** | `a.GetB().GetC().GetD()` chains | Introduce facade method, apply Law of Demeter |
| **Refused Bequest** | Subclass overriding to throw or no-op | Replace inheritance with composition |
| **Inappropriate Intimacy** | Class accessing private/internal members of another | Extract interface, reduce to public contract |
| **Alternative Classes** | Two classes doing same thing differently | Unify behind common interface |
| **Parallel Inheritance** | Adding subclass forces parallel subclass elsewhere | Merge hierarchies, use composition |
| **Incomplete Library Class** | Library missing needed method | Extension methods, adapter pattern |

## Pragmatic Exceptions

Not every occurrence is a smell. Apply judgment:

- **Constructor injection >4 params**: Acceptable up to 6 for aggregate roots or handlers with many dependencies. Beyond 6, extract a facade service.
- **Switch on enum**: Acceptable when it's the single point of dispatch and cases are simple expressions. Smell only when duplicated.
- **Data Class as record**: A `record` DTO/command/query is NOT a data class smell — it's the correct pattern.
- **Comments for public API**: XML doc comments on public interfaces are documentation, not a smell.
- **Dead code in tests**: Commented test cases with `// TODO: re-enable after X` are acceptable short-term.

## Output Format

For each detected smell:

```text
[CRITICAL] Primitive Obsession
File: Features/Orders/CreateOrderHandler.cs:15
Smell: Using string for email parameter instead of Email ValueObject
Fix: Replace string with Email ValueObject using Create() factory
```

## Additional Resources

### Reference Files

For the complete smell catalog with detailed detection patterns, C# examples, and refactoring steps:
- **`references/smell-catalog.md`** — Full 23-smell reference with before/after C# code for each smell

### Related Skills

- **`csharp-patterns`** — Functional C# patterns (Result, Maybe, ValueObject) used in many smell fixes
- **`csharp-testing`** — Write tests before refactoring smells to ensure behavior preservation
