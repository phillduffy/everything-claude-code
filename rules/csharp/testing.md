---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Testing

> This file extends [common/testing.md](../common/testing.md) with C# specific content.

## Framework

- **xUnit v3** (`xunit.v3`) for test runner
- **NSubstitute** (BSD-3) for mocking
- **Verify.XunitV3** for snapshot testing

## TDD with Result/Maybe

Write tests against `Result<TValue, Error>` outcomes:

```csharp
[Fact]
public void CreateEmail_ValidInput_ReturnsSuccess()
{
    var result = Email.Create("user@example.com");

    Assert.True(result.IsSuccess);
    Assert.Equal("user@example.com", result.Value.Value);
}

[Fact]
public void CreateEmail_EmptyInput_ReturnsFailure()
{
    var result = Email.Create("");

    Assert.True(result.IsFailure);
}
```

## Coverage

```bash
dotnet test --collect:"XPlat Code Coverage"
```

## Reference

See skill: `csharp-testing` for detailed xUnit v3, NSubstitute, and TDD patterns.
