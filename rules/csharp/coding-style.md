---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with C# specific content.

## Formatting

- **dotnet format** is mandatory — run on every save/edit
- Use `.editorconfig` for project-wide style enforcement

## Immutability

- Use `record` types for DTOs and value objects
- Use `init` accessors instead of `set`
- Use `IReadOnlyList<T>`, `IReadOnlyDictionary<K,V>` for collections
- Use `with` expressions for creating modified copies

```csharp
// Good: Immutable record
public record CreateUserCommand(string Email, string Name);

// Good: Init-only properties
public class Config
{
    public string ConnectionString { get; init; } = "";
}

// Good: Immutable collection
public IReadOnlyList<Item> Items => _items.AsReadOnly();
```

## Error Handling

Use `Result<TValue, Error>` from CSharpFunctionalExtensions instead of exceptions for expected failures:

```csharp
// Good: Result for expected failures
public Result<User, Error> GetUser(UserId id)
{
    var user = _db.Find(id);
    if (user is null)
        return DomainErrors.User.NotFound(id);
    return user;
}

// Good: Maybe for optional values
public Maybe<User> FindByEmail(string email) =>
    _db.Users.FirstOrDefault(u => u.Email == email) ?? Maybe<User>.None;
```

## Reference

See skill: `csharp-patterns` for comprehensive C# functional patterns and conventions.
