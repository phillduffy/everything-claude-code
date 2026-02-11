---
description: Comprehensive C# code review for functional patterns, immutability, Result/Maybe usage, and security. Invokes the csharp-reviewer agent.
---

# C# Code Review

This command invokes the **csharp-reviewer** agent for comprehensive C#-specific code review.

## What This Command Does

1. **Identify C# Changes**: Find modified `.cs` files via `git diff`
2. **Run Build Verification**: Execute `dotnet build` and `dotnet format --verify-no-changes`
3. **Security Scan**: Check for SQL injection, deserialization attacks, command injection
4. **Result/Maybe Review**: Verify proper use of `Result<TValue, Error>` and `Maybe<T>`
5. **Immutability Check**: Ensure records, init, and IReadOnlyList patterns
6. **Generate Report**: Categorize issues by severity

## When to Use

Use `/csharp-review` when:
- After writing or modifying C# code
- Before committing C# changes
- Reviewing pull requests with C# code
- Verifying Result/Maybe pattern compliance
- Checking immutability and type safety

## Review Categories

### CRITICAL (Must Fix)
- SQL/Command injection vulnerabilities
- BinaryFormatter or TypeNameHandling.All usage
- Exceptions for control flow instead of Result<T, Error>
- Missing Result returns on methods that can fail
- Mutable properties where init should be used
- Hardcoded secrets

### HIGH (Should Fix)
- Primitive obsession (string instead of ValueObject)
- Nullable reference warnings ignored
- Service locator pattern instead of constructor injection
- Tell Don't Ask violations
- CQS violations (commands returning values)
- Large functions >50 lines, deep nesting >4

### MEDIUM (Consider)
- Multiple LINQ enumerations
- String concatenation in loops
- Missing CancellationToken propagation
- Sync over async (.Result, .Wait())
- N+1 database queries

## Automated Checks Run

```bash
# Build verification
dotnet build

# Format check
dotnet format --verify-no-changes

# Run tests
dotnet test

# Vulnerable packages
dotnet list package --vulnerable
```

## Example Usage

```text
User: /csharp-review

Agent:
# C# Code Review Report

## Files Reviewed
- Features/Users/CreateUserHandler.cs (modified)
- Domain/ValueObjects/Email.cs (modified)

## Build & Format
✓ dotnet build: Success
✓ dotnet format: No violations

## Issues Found

[CRITICAL] Exception for control flow
File: Features/Users/CreateUserHandler.cs:28
Issue: Throwing NotFoundException instead of returning Result
```csharp
// Bad
return _db.Find(id) ?? throw new NotFoundException("User not found");
```
Fix: Return Result<T, Error>
```csharp
var user = _db.Find(id);
if (user is null)
    return DomainErrors.User.NotFound(id);
return user;
```

[HIGH] Primitive obsession
File: Features/Users/CreateUserHandler.cs:15
Issue: Using string for email instead of Email ValueObject
```csharp
// Bad
public Result<Guid, Error> Handle(string email)
```
Fix: Use typed Email parameter
```csharp
public Result<Guid, Error> Handle(Email email)
```

## Summary
- CRITICAL: 1
- HIGH: 1
- MEDIUM: 0

Recommendation: Block merge until CRITICAL issue is fixed
```

## Approval Criteria

| Status | Condition |
|--------|-----------|
| Approve | No CRITICAL or HIGH issues |
| Warning | Only MEDIUM issues (merge with caution) |
| Block | CRITICAL or HIGH issues found |

## Integration with Other Commands

- Use `/csharp-test` first to ensure tests pass
- Use `/csharp-build` if build errors occur
- Use `/csharp-review` before committing
- Use `/code-review` for non-C# specific concerns

## Related

- Agent: `agents/csharp-reviewer.md`
- Skills: `skills/csharp-patterns/`, `skills/csharp-testing/`
