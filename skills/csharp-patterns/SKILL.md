---
name: csharp-patterns
description: Functional C# patterns using CSharpFunctionalExtensions — Result/Maybe monads, ValueObject, immutable records, vertical slices, CQS, and Parse Don't Validate. No MediatR.
---

# C# Functional Patterns

Functional C# patterns for building robust, type-safe, and maintainable applications using CSharpFunctionalExtensions.

## When to Activate

- Writing new C# code or reviewing C# changes
- Designing domain models, commands, or queries
- Refactoring toward functional patterns
- Working with error handling or optional values

## Core Principles

### 1. Result<TValue, Error> for Error Handling

Use `Result<TValue, Error>` instead of throwing exceptions for expected failures.

```csharp
using CSharpFunctionalExtensions;

// Good: Result for expected failures
public Result<User, Error> GetUser(UserId id)
{
    var user = _db.Find(id);
    if (user is null)
        return DomainErrors.User.NotFound(id);
    return user;
}

// Good: Chaining Results
public Result<OrderConfirmation, Error> PlaceOrder(PlaceOrderCommand cmd)
{
    return Email.Create(cmd.Email)
        .Bind(email => _userRepo.FindByEmail(email))
        .Bind(user => _orderService.Create(user, cmd.Items))
        .Map(order => new OrderConfirmation(order.Id));
}

// Bad: Throwing for expected cases
public User GetUser(UserId id)
{
    return _db.Find(id) ?? throw new NotFoundException("User not found");
}
```

### 2. Maybe<T> for Optional Values

Use `Maybe<T>` instead of null for values that may not exist.

```csharp
// Good: Maybe for optional lookups
public Maybe<User> FindByEmail(string email)
{
    var user = _db.Users.FirstOrDefault(u => u.Email == email);
    return user is null ? Maybe<User>.None : Maybe.From(user);
}

// Good: Consuming Maybe
var maybeUser = _repo.FindByEmail(email);
maybeUser.Execute(user => SendWelcome(user));

// Good: Converting Maybe to Result
var result = maybeUser.ToResult(DomainErrors.User.NotFound(email));

// Bad: Returning null
public User? FindByEmail(string email) => _db.Users.FirstOrDefault(...);
```

### 3. ValueObject Base Class

Eliminate primitive obsession with domain-specific value types.

```csharp
public class Email : ValueObject
{
    public string Value { get; }

    private Email(string value) => Value = value;

    public static Result<Email, Error> Create(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return DomainErrors.Email.Empty;

        input = input.Trim().ToLowerInvariant();

        if (!Regex.IsMatch(input, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            return DomainErrors.Email.InvalidFormat;

        return new Email(input);
    }

    protected override IEnumerable<IComparable> GetEqualityComponents()
    {
        yield return Value;
    }
}

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
        if (amount < 0)
            return DomainErrors.Money.NegativeAmount;
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
            return DomainErrors.Money.InvalidCurrency;
        return new Money(amount, currency.ToUpperInvariant());
    }

    protected override IEnumerable<IComparable> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
```

### 4. Immutable Records

Use records with `init` properties for DTOs and commands.

```csharp
// Good: Immutable command
public record CreateUserCommand(string Email, string Name);

// Good: Immutable response
public record UserResponse(Guid Id, string Email, string Name, DateTime CreatedAt);

// Good: Record with init properties for complex types
public record OrderSummary
{
    public Guid Id { get; init; }
    public IReadOnlyList<OrderLineItem> Items { get; init; } = [];
    public Money Total { get; init; } = null!;
}

// Good: Modifying via with expression
var updated = original with { Name = "New Name" };

// Bad: Mutable class with setters
public class UserDto
{
    public string Email { get; set; } = ""; // Mutable!
}
```

### 5. Parse Don't Validate

Static factory methods returning `Result<T, Error>` instead of constructors that throw.

```csharp
// Good: Parse, don't validate
public static Result<Age, Error> Create(int value)
{
    if (value < 0 || value > 150)
        return DomainErrors.Age.OutOfRange(value);
    return new Age(value);
}

// Usage: Composition of parsed values
public Result<User, Error> CreateUser(CreateUserCommand cmd)
{
    return Email.Create(cmd.Email)
        .Bind(email => Name.Create(cmd.Name)
            .Map(name => new User(email, name)));
}

// Bad: Validate then use primitives
public void CreateUser(string email, string name)
{
    if (!IsValidEmail(email)) throw new ArgumentException("...");
    var user = new User { Email = email }; // Still a raw string
}
```

### 6. Domain Error Definitions

Centralize errors as static classes for discoverability.

```csharp
public static class DomainErrors
{
    public static class User
    {
        public static Error NotFound(UserId id) =>
            new($"User with ID '{id.Value}' was not found.");

        public static Error DuplicateEmail(string email) =>
            new($"A user with email '{email}' already exists.");
    }

    public static class Email
    {
        public static readonly Error Empty = new("Email cannot be empty.");
        public static readonly Error InvalidFormat = new("Email format is invalid.");
    }

    public static class Money
    {
        public static readonly Error NegativeAmount = new("Amount cannot be negative.");
        public static readonly Error InvalidCurrency = new("Currency must be a 3-letter ISO code.");
    }
}
```

### 7. Command/Query Separation (CQS)

Separate commands (write) from queries (read) without MediatR.

```csharp
// Command handler — returns Result, mutates state
public interface ICommandHandler<in TCommand, TResult>
{
    Task<Result<TResult, Error>> HandleAsync(TCommand command, CancellationToken ct = default);
}

public class CreateUserHandler : ICommandHandler<CreateUserCommand, Guid>
{
    private readonly IUserRepository _repo;

    public CreateUserHandler(IUserRepository repo) => _repo = repo;

    public async Task<Result<Guid, Error>> HandleAsync(
        CreateUserCommand command, CancellationToken ct = default)
    {
        return await Email.Create(command.Email)
            .Bind(email => _repo.ExistsAsync(email, ct)
                .Result  // Simplified — see async patterns below
                .Bind(exists => exists
                    ? Result.Failure<Email, Error>(DomainErrors.User.DuplicateEmail(command.Email))
                    : Result.Success<Email, Error>(email)))
            .Map(async email =>
            {
                var user = new User(email, command.Name);
                await _repo.AddAsync(user, ct);
                return user.Id;
            });
    }
}

// Query handler — returns data, no side effects
public interface IQueryHandler<in TQuery, TResult>
{
    Task<Result<TResult, Error>> HandleAsync(TQuery query, CancellationToken ct = default);
}
```

### 8. Constructor Injection

All dependencies injected via constructor. No service locator.

```csharp
// Good: Explicit dependencies
public class OrderService
{
    private readonly IOrderRepository _orderRepo;
    private readonly IPaymentGateway _paymentGateway;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepo,
        IPaymentGateway paymentGateway,
        ILogger<OrderService> logger)
    {
        _orderRepo = orderRepo;
        _paymentGateway = paymentGateway;
        _logger = logger;
    }
}

// Bad: Service locator
public class OrderService
{
    public void Process()
    {
        var repo = ServiceLocator.Get<IOrderRepository>(); // Hidden dependency!
    }
}
```

### 9. Options Pattern for Configuration

```csharp
public class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; init; } = "";
    public int Port { get; init; } = 587;
    public string Username { get; init; } = "";
}

// Registration
services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));

// Usage via injection
public class EmailSender
{
    private readonly SmtpOptions _options;

    public EmailSender(IOptions<SmtpOptions> options) =>
        _options = options.Value;
}
```

### 10. Tell Don't Ask

Tell objects what to do; don't ask for their state and decide externally.

```csharp
// Good: Tell
order.Cancel(reason);

// Bad: Ask then act
if (order.Status == OrderStatus.Active && order.CanCancel)
{
    order.Status = OrderStatus.Cancelled;
    order.CancelledAt = DateTime.UtcNow;
    order.CancelReason = reason;
}
```

### 11. Immutable Collections

```csharp
// Good: Expose read-only
public class Order
{
    private readonly List<OrderLine> _lines = [];

    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();

    public Result<OrderLine, Error> AddLine(Product product, int quantity)
    {
        var line = new OrderLine(product, quantity);
        _lines.Add(line);
        return line;
    }
}

// Bad: Exposing mutable list
public List<OrderLine> Lines { get; set; } = [];
```

### 12. Extension Methods for Readability

```csharp
public static class ResultExtensions
{
    public static async Task<Result<TNew, Error>> BindAsync<T, TNew>(
        this Result<T, Error> result,
        Func<T, Task<Result<TNew, Error>>> func)
    {
        if (result.IsFailure)
            return Result.Failure<TNew, Error>(result.Error);
        return await func(result.Value);
    }
}
```

### 13. Guard Clauses at Boundaries

Validate at system boundaries (controllers, API endpoints), not deep inside domain.

```csharp
// Controller — system boundary
[HttpPost]
public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Email))
        return BadRequest("Email is required");

    var result = await _handler.HandleAsync(new CreateUserCommand(request.Email, request.Name));

    return result.IsSuccess
        ? Ok(result.Value)
        : BadRequest(result.Error.Message);
}
```

### 14. Async/Await Patterns

```csharp
// Good: Async all the way down
public async Task<Result<User, Error>> GetUserAsync(UserId id, CancellationToken ct)
{
    var user = await _db.Users.FindAsync(id, ct);
    if (user is null)
        return DomainErrors.User.NotFound(id);
    return user;
}

// Good: Pass CancellationToken everywhere
public async Task<IReadOnlyList<Order>> GetOrdersAsync(UserId userId, CancellationToken ct) =>
    await _db.Orders.Where(o => o.UserId == userId).ToListAsync(ct);

// Bad: .Result or .Wait() blocking
var user = GetUserAsync(id).Result; // Deadlock risk!
```

### 15. LINQ Best Practices

```csharp
// Good: Materialize once
var users = await _db.Users.Where(u => u.IsActive).ToListAsync(ct);
var count = users.Count;

// Bad: Multiple enumeration
var query = _db.Users.Where(u => u.IsActive);
var count = query.Count();    // First enumeration
var list = query.ToList();    // Second enumeration

// Good: Use Any() instead of Count() > 0
if (await _db.Users.AnyAsync(u => u.Email == email, ct))
    return DomainErrors.User.DuplicateEmail(email);
```

### 16. Null Handling

```csharp
// Good: Nullable reference types where enabled
public User? FindById(Guid id) => _db.Users.Find(id);

// Good: Convert null to Maybe at boundary
public Maybe<User> FindByEmail(string email) =>
    _db.Users.FirstOrDefault(u => u.Email == email) ?? Maybe<User>.None;

// Good: Null-conditional and null-coalescing
var name = user?.Profile?.DisplayName ?? "Unknown";
```

### 17. Interface Segregation

```csharp
// Good: Small, focused interfaces
public interface IUserRepository
{
    Task<Maybe<User>> FindByIdAsync(UserId id, CancellationToken ct);
    Task<bool> ExistsAsync(Email email, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);
}

// Bad: God interface
public interface IRepository<T>
{
    Task<T> FindAsync(int id);
    Task<List<T>> FindAllAsync();
    Task AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(int id);
    Task<int> CountAsync();
    // ... 20 more methods
}
```

### 18. Vertical Slice File Organization

```
Features/
  Users/
    CreateUser/
      CreateUserCommand.cs
      CreateUserHandler.cs
      CreateUserEndpoint.cs
    GetUser/
      GetUserQuery.cs
      GetUserHandler.cs
      GetUserEndpoint.cs
  Orders/
    PlaceOrder/
      PlaceOrderCommand.cs
      PlaceOrderHandler.cs
      PlaceOrderEndpoint.cs
```

### 19. Composition via Interfaces

```csharp
// Good: Compose behaviors
public class CachedUserRepository : IUserRepository
{
    private readonly IUserRepository _inner;
    private readonly IMemoryCache _cache;

    public CachedUserRepository(IUserRepository inner, IMemoryCache cache)
    {
        _inner = inner;
        _cache = cache;
    }

    public async Task<Maybe<User>> FindByIdAsync(UserId id, CancellationToken ct) =>
        await _cache.GetOrCreateAsync($"user:{id.Value}",
            _ => _inner.FindByIdAsync(id, ct));
}
```

## Quick Reference

| Concept | Pattern |
|---------|---------|
| Error handling | `Result<TValue, Error>` |
| Optional values | `Maybe<T>` |
| Domain primitives | `ValueObject` base class |
| DTOs / Commands | `record` with `init` |
| Modify immutable | `with` expression |
| Collections | `IReadOnlyList<T>` |
| Dependencies | Constructor injection |
| Configuration | `IOptions<T>` pattern |
| File organization | Vertical slices |
| Handler pattern | `ICommandHandler<T, R>` / `IQueryHandler<T, R>` |

## Anti-Patterns (NEVER Use)

| Anti-Pattern | Why | Use Instead |
|-------------|-----|-------------|
| MediatR | Forbidden per project rules | Direct handler injection |
| Mutable DTOs | Side effects, bugs | Records with `init` |
| Exceptions for flow control | Expensive, unclear | `Result<T, Error>` |
| Service locator | Hidden dependencies | Constructor injection |
| `dynamic` type | Bypasses type safety | Generics / interfaces |
| `#region` blocks | Hides complexity | Small files |
| `BinaryFormatter` | Security vulnerability | `System.Text.Json` |
| `async void` | Unobservable exceptions | `async Task` |
| Commented-out code | Dead code | Delete it |
