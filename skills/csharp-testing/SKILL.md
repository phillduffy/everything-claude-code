---
name: csharp-testing
description: C# testing patterns with xUnit v3, NSubstitute, Verify.XunitV3, and TDD workflow. Tests Result/Maybe patterns from CSharpFunctionalExtensions.
---

# C# Testing Patterns

Comprehensive C# testing patterns for writing reliable, maintainable tests following TDD methodology with xUnit v3.

## When to Activate

- Writing new C# functions, handlers, or services
- Adding test coverage to existing code
- Following TDD workflow in C# projects
- Testing Result/Maybe patterns
- Mocking dependencies with NSubstitute

## TDD Workflow

### The RED-GREEN-REFACTOR Cycle

```
RED     → Write a failing test first
GREEN   → Write minimal code to pass the test
REFACTOR → Improve code while keeping tests green
REPEAT  → Continue with next requirement
```

### Step-by-Step TDD in C\#

```csharp
// Step 1: Define the signature
public static Result<Email, Error> Create(string input)
{
    throw new NotImplementedException();
}

// Step 2: Write failing test (RED)
[Fact]
public void Create_ValidEmail_ReturnsSuccess()
{
    var result = Email.Create("user@example.com");

    Assert.True(result.IsSuccess);
    Assert.Equal("user@example.com", result.Value.Value);
}

// Step 3: Run test — verify FAIL
// dotnet test → FAIL: NotImplementedException

// Step 4: Implement minimal code (GREEN)
public static Result<Email, Error> Create(string input)
{
    if (string.IsNullOrWhiteSpace(input))
        return DomainErrors.Email.Empty;
    return new Email(input.Trim().ToLowerInvariant());
}

// Step 5: Run test — verify PASS
// dotnet test → PASS

// Step 6: Refactor, verify tests still pass
```

## xUnit v3 Patterns

### Fact — Single Test Case

```csharp
[Fact]
public void CreateEmail_EmptyInput_ReturnsFailure()
{
    var result = Email.Create("");

    Assert.True(result.IsFailure);
    Assert.Equal(DomainErrors.Email.Empty, result.Error);
}
```

### Theory/InlineData — Parameterized Tests

```csharp
[Theory]
[InlineData("user@example.com")]
[InlineData("first.last@domain.co.uk")]
[InlineData("user+tag@example.com")]
public void CreateEmail_ValidInputs_ReturnsSuccess(string email)
{
    var result = Email.Create(email);

    Assert.True(result.IsSuccess);
}

[Theory]
[InlineData("")]
[InlineData("   ")]
[InlineData("no-at-sign")]
[InlineData("@no-local.com")]
[InlineData("user@")]
public void CreateEmail_InvalidInputs_ReturnsFailure(string email)
{
    var result = Email.Create(email);

    Assert.True(result.IsFailure);
}
```

### MemberData — Complex Test Data

```csharp
public static TheoryData<CreateUserCommand, Error> InvalidCommands => new()
{
    { new CreateUserCommand("", "John"), DomainErrors.Email.Empty },
    { new CreateUserCommand("bad", "John"), DomainErrors.Email.InvalidFormat },
    { new CreateUserCommand("a@b.com", ""), DomainErrors.User.NameEmpty },
};

[Theory]
[MemberData(nameof(InvalidCommands))]
public async Task Handle_InvalidCommand_ReturnsExpectedError(
    CreateUserCommand command, Error expectedError)
{
    var result = await _handler.HandleAsync(command);

    Assert.True(result.IsFailure);
    Assert.Equal(expectedError, result.Error);
}
```

### ClassFixture — Shared Setup

```csharp
public class DatabaseFixture : IAsyncLifetime
{
    public AppDbContext Db { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        Db = new AppDbContext(options);
        await Db.Database.EnsureCreatedAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await Db.DisposeAsync();
    }
}

public class UserRepositoryTests : IClassFixture<DatabaseFixture>
{
    private readonly AppDbContext _db;

    public UserRepositoryTests(DatabaseFixture fixture) => _db = fixture.Db;

    [Fact]
    public async Task FindById_ExistingUser_ReturnsMaybe()
    {
        var user = new User(Email.Create("test@test.com").Value, "Test");
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var repo = new UserRepository(_db);
        var result = await repo.FindByIdAsync(user.Id, CancellationToken.None);

        Assert.True(result.HasValue);
    }
}
```

### IAsyncLifetime — Per-Test Setup/Teardown

```csharp
public class OrderServiceTests : IAsyncLifetime
{
    private AppDbContext _db = null!;
    private OrderService _sut = null!;

    public async ValueTask InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);
        await _db.Database.EnsureCreatedAsync();
        _sut = new OrderService(new OrderRepository(_db));
    }

    public async ValueTask DisposeAsync() => await _db.DisposeAsync();

    [Fact]
    public async Task PlaceOrder_ValidItems_ReturnsSuccess()
    {
        var result = await _sut.PlaceOrderAsync(new PlaceOrderCommand(/* ... */));
        Assert.True(result.IsSuccess);
    }
}
```

## Testing Result<TValue, Error>

### Success Path

```csharp
[Fact]
public void Create_ValidInput_ReturnsSuccessWithValue()
{
    var result = Money.Create(100m, "USD");

    Assert.True(result.IsSuccess);
    Assert.Equal(100m, result.Value.Amount);
    Assert.Equal("USD", result.Value.Currency);
}
```

### Failure Path

```csharp
[Fact]
public void Create_NegativeAmount_ReturnsFailure()
{
    var result = Money.Create(-1m, "USD");

    Assert.True(result.IsFailure);
    Assert.Equal(DomainErrors.Money.NegativeAmount, result.Error);
}
```

### Chained Results

```csharp
[Fact]
public async Task Handle_ValidCommand_CreatesUserAndReturnsId()
{
    var repo = Substitute.For<IUserRepository>();
    repo.ExistsAsync(Arg.Any<Email>(), Arg.Any<CancellationToken>())
        .Returns(false);

    var handler = new CreateUserHandler(repo);
    var result = await handler.HandleAsync(new CreateUserCommand("a@b.com", "Test"));

    Assert.True(result.IsSuccess);
    await repo.Received(1).AddAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
}
```

## Testing Maybe<T>

```csharp
[Fact]
public async Task FindByEmail_Exists_ReturnsValue()
{
    var expected = new User(Email.Create("a@b.com").Value, "Test");
    var repo = Substitute.For<IUserRepository>();
    repo.FindByEmailAsync(Arg.Any<Email>(), Arg.Any<CancellationToken>())
        .Returns(Maybe.From(expected));

    var result = await repo.FindByEmailAsync(
        Email.Create("a@b.com").Value, CancellationToken.None);

    Assert.True(result.HasValue);
    Assert.Equal("Test", result.Value.Name);
}

[Fact]
public async Task FindByEmail_NotFound_ReturnsNone()
{
    var repo = Substitute.For<IUserRepository>();
    repo.FindByEmailAsync(Arg.Any<Email>(), Arg.Any<CancellationToken>())
        .Returns(Maybe<User>.None);

    var result = await repo.FindByEmailAsync(
        Email.Create("missing@test.com").Value, CancellationToken.None);

    Assert.True(result.HasNoValue);
}
```

## NSubstitute Mocking

### Basic Substitution

```csharp
var repo = Substitute.For<IUserRepository>();

// Arrange returns
repo.FindByIdAsync(Arg.Any<UserId>(), Arg.Any<CancellationToken>())
    .Returns(Maybe.From(new User(email, "Test")));

// Verify calls
await repo.Received(1).AddAsync(Arg.Is<User>(u => u.Name == "Test"), Arg.Any<CancellationToken>());
await repo.DidNotReceive().DeleteAsync(Arg.Any<UserId>(), Arg.Any<CancellationToken>());
```

### Argument Matching

```csharp
// Any argument
repo.FindByIdAsync(Arg.Any<UserId>(), Arg.Any<CancellationToken>());

// Specific value
repo.FindByIdAsync(Arg.Is(expectedId), Arg.Any<CancellationToken>());

// Predicate
repo.FindByIdAsync(
    Arg.Is<UserId>(id => id.Value != Guid.Empty),
    Arg.Any<CancellationToken>());
```

### Conditional Returns

```csharp
repo.FindByIdAsync(Arg.Any<UserId>(), Arg.Any<CancellationToken>())
    .Returns(callInfo =>
    {
        var id = callInfo.Arg<UserId>();
        return id.Value == knownId
            ? Maybe.From(existingUser)
            : Maybe<User>.None;
    });
```

### Throwing Exceptions

```csharp
repo.FindByIdAsync(Arg.Any<UserId>(), Arg.Any<CancellationToken>())
    .ThrowsAsync(new DbException("Connection failed"));
```

## Assertions

### Built-in Assert (Primary)

```csharp
// Equality
Assert.Equal(expected, actual);
Assert.NotEqual(unexpected, actual);

// Boolean
Assert.True(condition);
Assert.False(condition);

// Null
Assert.Null(value);
Assert.NotNull(value);

// Collections
Assert.Empty(collection);
Assert.Single(collection);
Assert.Contains(item, collection);
Assert.All(collection, item => Assert.True(item.IsValid));

// Type
Assert.IsType<ExpectedType>(actual);

// Exceptions
var ex = Assert.Throws<ArgumentException>(() => DoSomething());
Assert.Equal("Expected message", ex.Message);

// Async exceptions
var ex = await Assert.ThrowsAsync<InvalidOperationException>(
    () => DoSomethingAsync());
```

### Shouldly (Optional Upgrade — BSD-3, Free)

If the project adopts Shouldly for more readable assertions:

```csharp
// Instead of Assert.Equal(expected, actual)
actual.ShouldBe(expected);

// Instead of Assert.True(result.IsSuccess)
result.IsSuccess.ShouldBeTrue();

// Instead of Assert.Contains(item, collection)
collection.ShouldContain(item);

// Instead of Assert.Throws<T>
Should.Throw<ArgumentException>(() => DoSomething());
```

## Verify.XunitV3 Snapshot Testing

```csharp
[Fact]
public async Task GetUser_ReturnsExpectedShape()
{
    var user = new UserResponse(
        Guid.Parse("550e8400-e29b-41d4-a716-446655440000"),
        "test@example.com",
        "Test User",
        new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc));

    await Verify(user);
}

// Verified snapshot file: GetUser_ReturnsExpectedShape.verified.txt
// {
//   Id: 550e8400-e29b-41d4-a716-446655440000,
//   Email: test@example.com,
//   Name: Test User,
//   CreatedAt: 2024-01-01T00:00:00.0000000Z
// }
```

## Test Organization

```
Tests/
  Unit/
    Domain/
      EmailTests.cs
      MoneyTests.cs
    Features/
      Users/
        CreateUserHandlerTests.cs
        GetUserHandlerTests.cs
  Integration/
    Repositories/
      UserRepositoryTests.cs
    Endpoints/
      UserEndpointTests.cs
```

## Async Testing

```csharp
// Good: Async test methods
[Fact]
public async Task Handle_ValidCommand_ReturnsSuccess()
{
    var result = await _handler.HandleAsync(command);
    Assert.True(result.IsSuccess);
}

// Good: Testing CancellationToken respect
[Fact]
public async Task Handle_Cancelled_ThrowsOperationCancelled()
{
    var cts = new CancellationTokenSource();
    cts.Cancel();

    await Assert.ThrowsAsync<OperationCanceledException>(
        () => _handler.HandleAsync(command, cts.Token));
}
```

## Coverage

### Commands

```bash
# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Generate HTML report (requires reportgenerator tool)
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coverage-report

# Run specific test project
dotnet test tests/MyProject.Tests --collect:"XPlat Code Coverage"
```

### Coverage Targets

| Code Type | Target |
|-----------|--------|
| Domain logic / ValueObjects | 100% |
| Command/Query handlers | 90%+ |
| General code | 80%+ |
| Generated / migrations | Exclude |

## Best Practices

**DO:**
- Write test FIRST, before implementation
- Test behavior, not implementation details
- Use descriptive test names: `MethodName_Scenario_ExpectedResult`
- One assertion concept per test
- Use `CancellationToken.None` in tests explicitly
- Test both `IsSuccess` and `IsFailure` paths of `Result<T, Error>`

**DON'T:**
- Write implementation before tests
- Test private methods directly
- Use `Thread.Sleep` — use async patterns instead
- Mock what you don't own (wrap external libs first)
- Share mutable state between tests
- Use `FluentAssertions` (paid license — use `Assert.*` or `Shouldly`)
