---
description: Enforce TDD workflow for C#. Write xUnit v3 tests first, then implement using Result/Maybe patterns. Verify 80%+ coverage.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# C# TDD Command

This command enforces test-driven development methodology for C# code using xUnit v3, NSubstitute, and Result/Maybe patterns.

## What This Command Does

1. **Define Types/Interfaces**: Scaffold signatures and ValueObjects first
2. **Write xUnit v3 Tests**: Create comprehensive test cases (RED)
3. **Run Tests**: Verify tests fail for the right reason
4. **Implement Code**: Write minimal code to pass (GREEN)
5. **Refactor**: Improve while keeping tests green
6. **Check Coverage**: Ensure 80%+ coverage

## When to Use

Use `/csharp-test` when:
- Implementing new C# handlers, services, or ValueObjects
- Adding test coverage to existing code
- Fixing bugs (write failing test first)
- Building domain logic with Result/Maybe patterns
- Learning TDD workflow in C#

## TDD Cycle

```
RED     → Write failing xUnit test
GREEN   → Implement minimal code to pass
REFACTOR → Improve code, tests stay green
REPEAT  → Next test case
```

## Example Session

```text
User: /csharp-test I need a Money ValueObject with amount and currency

Agent:
# TDD Session: Money ValueObject

## Step 1: Define Skeleton

```csharp
// Domain/ValueObjects/Money.cs
using CSharpFunctionalExtensions;

public class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Result<Money, Error> Create(decimal amount, string currency)
    {
        throw new NotImplementedException();
    }

    protected override IEnumerable<IComparable> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
```

## Step 2: Write Tests (RED)

```csharp
// Tests/Unit/Domain/MoneyTests.cs
using Xunit;

public class MoneyTests
{
    [Theory]
    [InlineData(100, "USD")]
    [InlineData(0, "EUR")]
    [InlineData(99.99, "GBP")]
    public void Create_ValidInputs_ReturnsSuccess(decimal amount, string currency)
    {
        var result = Money.Create(amount, currency);

        Assert.True(result.IsSuccess);
        Assert.Equal(amount, result.Value.Amount);
        Assert.Equal(currency, result.Value.Currency);
    }

    [Fact]
    public void Create_NegativeAmount_ReturnsFailure()
    {
        var result = Money.Create(-1m, "USD");

        Assert.True(result.IsFailure);
        Assert.Equal(DomainErrors.Money.NegativeAmount, result.Error);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("US")]
    [InlineData("ABCD")]
    public void Create_InvalidCurrency_ReturnsFailure(string currency)
    {
        var result = Money.Create(100m, currency);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public void Create_NormalizesToUpperCase()
    {
        var result = Money.Create(100m, "usd");

        Assert.True(result.IsSuccess);
        Assert.Equal("USD", result.Value.Currency);
    }

    [Fact]
    public void Equality_SameValues_AreEqual()
    {
        var a = Money.Create(100m, "USD").Value;
        var b = Money.Create(100m, "USD").Value;

        Assert.Equal(a, b);
    }

    [Fact]
    public void Equality_DifferentValues_AreNotEqual()
    {
        var a = Money.Create(100m, "USD").Value;
        var b = Money.Create(200m, "USD").Value;

        Assert.NotEqual(a, b);
    }
}
```

## Step 3: Run Tests — Verify FAIL

```bash
$ dotnet test --filter "MoneyTests"

Failed! - 6 tests failed
  NotImplementedException
```

Tests fail as expected (NotImplementedException).

## Step 4: Implement Minimal Code (GREEN)

```csharp
public static Result<Money, Error> Create(decimal amount, string currency)
{
    if (amount < 0)
        return DomainErrors.Money.NegativeAmount;

    if (string.IsNullOrWhiteSpace(currency) || currency.Trim().Length != 3)
        return DomainErrors.Money.InvalidCurrency;

    return new Money(amount, currency.Trim().ToUpperInvariant());
}
```

## Step 5: Run Tests — Verify PASS

```bash
$ dotnet test --filter "MoneyTests"

Passed! - 6 tests passed
```

All tests passing!

## Step 6: Check Coverage

```bash
$ dotnet test --collect:"XPlat Code Coverage"
$ reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coverage

Money.cs: 100% line coverage
```

## TDD Complete!
```

## Test Patterns

### Fact — Single Case
```csharp
[Fact]
public void Method_Scenario_ExpectedResult()
{
    var result = Sut.Method(input);
    Assert.True(result.IsSuccess);
}
```

### Theory/InlineData — Parameterized
```csharp
[Theory]
[InlineData("valid@email.com", true)]
[InlineData("", false)]
[InlineData("no-at", false)]
public void CreateEmail_ReturnsExpected(string input, bool expectSuccess)
{
    var result = Email.Create(input);
    Assert.Equal(expectSuccess, result.IsSuccess);
}
```

### MemberData — Complex Data
```csharp
public static TheoryData<CreateUserCommand, Error> InvalidCommands => new()
{
    { new("", "John"), DomainErrors.Email.Empty },
    { new("bad", "John"), DomainErrors.Email.InvalidFormat },
};

[Theory]
[MemberData(nameof(InvalidCommands))]
public async Task Handle_InvalidInput_ReturnsError(CreateUserCommand cmd, Error expected)
{
    var result = await _handler.HandleAsync(cmd);
    Assert.True(result.IsFailure);
    Assert.Equal(expected, result.Error);
}
```

### ClassFixture — Shared Setup
```csharp
public class DbTests : IClassFixture<DatabaseFixture>
{
    private readonly AppDbContext _db;
    public DbTests(DatabaseFixture fixture) => _db = fixture.Db;
}
```

### IAsyncLifetime — Per-Test Lifecycle
```csharp
public class ServiceTests : IAsyncLifetime
{
    private AppDbContext _db = null!;

    public async ValueTask InitializeAsync() { /* setup */ }
    public async ValueTask DisposeAsync() { /* cleanup */ }
}
```

### NSubstitute — Mocking
```csharp
var repo = Substitute.For<IUserRepository>();
repo.FindByIdAsync(Arg.Any<UserId>(), Arg.Any<CancellationToken>())
    .Returns(Maybe.From(existingUser));

await repo.Received(1).AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
```

## Coverage Commands

```bash
# Run with coverage
dotnet test --collect:"XPlat Code Coverage"

# HTML report
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coverage-report

# Specific project
dotnet test tests/MyProject.Tests --collect:"XPlat Code Coverage"
```

## Coverage Targets

| Code Type | Target |
|-----------|--------|
| Domain logic / ValueObjects | 100% |
| Command/Query handlers | 90%+ |
| General code | 80%+ |
| Generated / migrations | Exclude |

## TDD Best Practices

**DO:**
- Write test FIRST, before any implementation
- Run tests after each change
- Test both `IsSuccess` and `IsFailure` paths
- Use descriptive names: `Method_Scenario_ExpectedResult`
- Test ValueObject equality via `Assert.Equal`
- Include edge cases (empty, null, boundary values)

**DON'T:**
- Write implementation before tests
- Skip the RED phase
- Test private methods directly
- Use `Thread.Sleep` — use async patterns
- Ignore flaky tests
- Use `FluentAssertions` (paid license)

## Related Commands

- `/csharp-build` — Fix build errors
- `/csharp-review` — Review code after implementation
- `/verify` — Run full verification loop

## Related

- Skill: `skills/csharp-testing/`
- Skill: `skills/tdd-workflow/`
