---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Patterns

> This file extends [common/patterns.md](../common/patterns.md) with C# specific content.

## ValueObject Base Class

Use `ValueObject` from CSharpFunctionalExtensions for domain primitives:

```csharp
public class Email : ValueObject
{
    public string Value { get; }

    private Email(string value) => Value = value;

    public static Result<Email, Error> Create(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return DomainErrors.Email.Empty;
        if (!input.Contains('@'))
            return DomainErrors.Email.InvalidFormat;
        return new Email(input.Trim().ToLowerInvariant());
    }

    protected override IEnumerable<IComparable> GetEqualityComponents()
    {
        yield return Value;
    }
}
```

## Parse Don't Validate

Static factory methods returning `Result<T, Error>` instead of constructors that throw:

```csharp
// Good: Parse, don't validate
var emailResult = Email.Create(rawInput);

// Bad: Constructor that throws
var email = new Email(rawInput); // throws ArgumentException
```

## Vertical Slice Organization

Organize by feature, not by technical layer:

```
Features/
  CreateUser/
    CreateUserCommand.cs
    CreateUserHandler.cs
    CreateUserValidator.cs
  GetUser/
    GetUserQuery.cs
    GetUserHandler.cs
```

## Composition Over Inheritance

- Use interfaces + constructor injection
- Avoid deep inheritance hierarchies
- Prefer delegation to base class coupling

## Reference

See skill: `csharp-patterns` for comprehensive C# functional patterns including Result/Maybe, CQS, and immutability.
