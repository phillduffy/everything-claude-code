# C# Code Smell Catalog

Complete reference for all 23 code smells from refactoring.guru, adapted for modern C#.

Source: <https://refactoring.guru/refactoring/smells>

---

## Category 1: Bloaters

Bloaters are code, methods, and classes that have grown so large they are hard to work with.

### 1. Long Method

**Threshold**: >25 lines (excluding braces, blank lines, using statements)

**Detection heuristics**:
- Count executable statements in method body
- Methods with multiple responsibilities (setup, process, cleanup)
- Methods requiring scrolling to read

**C# fix patterns**:

```csharp
// BEFORE: Long method doing too much
public async Task<Result<OrderConfirmation, Error>> PlaceOrder(PlaceOrderCommand cmd, CancellationToken ct)
{
    // Validate email (5 lines)
    // Check user exists (5 lines)
    // Validate inventory (8 lines)
    // Calculate totals (6 lines)
    // Create order (5 lines)
    // Send notification (4 lines)
    // Return confirmation (3 lines)
}

// AFTER: Extracted methods with descriptive names
public async Task<Result<OrderConfirmation, Error>> PlaceOrder(PlaceOrderCommand cmd, CancellationToken ct)
{
    return await ValidateEmail(cmd.Email)
        .Bind(email => FindUser(email, ct))
        .Bind(user => ValidateInventory(cmd.Items, ct))
        .Bind(items => CreateOrder(user, items, ct))
        .Tap(order => _notifier.SendConfirmation(order, ct))
        .Map(order => new OrderConfirmation(order.Id));
}
```

**Refactoring techniques**: Extract Method, Replace Temp with Query, Decompose Conditional, Replace Method with Method Object.

---

### 2. Large Class

**Threshold**: >250 lines (excluding using statements)

**Detection heuristics**:
- Class has 7+ fields
- Class has 10+ public methods
- Class name contains "Manager", "Processor", "Service" with broad scope
- Multiple `#region` blocks (hiding the size)

**C# fix patterns**:

```csharp
// BEFORE: God class
public class UserService  // 400+ lines
{
    // User CRUD (100 lines)
    // Email sending (80 lines)
    // Password management (70 lines)
    // Profile management (60 lines)
    // Notification preferences (50 lines)
}

// AFTER: Split by responsibility into vertical slices
Features/
  Users/
    CreateUser/CreateUserHandler.cs
    UpdateProfile/UpdateProfileHandler.cs
  Authentication/
    ResetPassword/ResetPasswordHandler.cs
  Notifications/
    UpdatePreferences/UpdatePreferencesHandler.cs
```

**Refactoring techniques**: Extract Class, Extract Subclass, Extract Interface, Vertical Slice.

---

### 3. Primitive Obsession

**Severity**: CRITICAL

**Detection heuristics**:
- `string` used for: email, phone, URL, currency code, country code
- `int`/`Guid` used for: entity IDs without wrapper
- `decimal` used for: money without currency
- `string` used for: status, type (should be enum or ValueObject)
- Method parameters mixing primitives that could be swapped (e.g., `string firstName, string lastName`)

**C# fix patterns**:

```csharp
// BEFORE: Primitives everywhere
public Result<Guid, Error> CreateUser(string email, string name, string phone)
{
    if (!email.Contains('@')) return DomainErrors.Email.InvalidFormat;
    // Validation scattered across methods
}

// AFTER: ValueObjects with Parse Don't Validate
public Result<UserId, Error> CreateUser(Email email, Name name, PhoneNumber phone)
{
    // Validation happened at construction — these are guaranteed valid
    var user = new User(email, name, phone);
    return user.Id;
}

// ValueObject implementation
public class PhoneNumber : ValueObject
{
    public string Value { get; }
    private PhoneNumber(string value) => Value = value;

    public static Result<PhoneNumber, Error> Create(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return DomainErrors.Phone.Empty;
        var digits = Regex.Replace(input, @"[^\d]", "");
        if (digits.Length < 10 || digits.Length > 15)
            return DomainErrors.Phone.InvalidLength;
        return new PhoneNumber(digits);
    }

    protected override IEnumerable<IComparable> GetEqualityComponents()
    {
        yield return Value;
    }
}
```

**Refactoring techniques**: Replace Data Value with Object (ValueObject), Introduce Parameter Object, Replace Type Code with Subclasses.

---

### 4. Long Parameter List

**Threshold**: >4 parameters

**Detection heuristics**:
- Method signatures wider than screen
- Multiple parameters of same type (easy to swap accidentally)
- Parameters that always travel together

**C# fix patterns**:

```csharp
// BEFORE: Too many params
public Result<Order, Error> CreateOrder(
    string customerEmail, string customerName,
    string street, string city, string zip, string country,
    List<(int productId, int quantity)> items)

// AFTER: Parameter objects
public record CreateOrderCommand(
    Email CustomerEmail,
    Name CustomerName,
    Address ShippingAddress,
    IReadOnlyList<OrderLineItem> Items);

public Result<Order, Error> CreateOrder(CreateOrderCommand command)
```

**Exception**: Constructor injection up to 6 dependencies is acceptable for handlers/services. Beyond 6, introduce a facade.

**Refactoring techniques**: Introduce Parameter Object, Preserve Whole Object, Replace Parameter with Method Call.

---

### 5. Data Clumps

**Detection heuristics**:
- Same 3+ fields appear in multiple classes (street, city, zip, country)
- Same 3+ parameters passed together to multiple methods
- Removing one field from the group would be meaningless

**C# fix patterns**:

```csharp
// BEFORE: Address fields scattered
public class Customer
{
    public string Street { get; init; }
    public string City { get; init; }
    public string Zip { get; init; }
    public string Country { get; init; }
}

public class Warehouse
{
    public string Street { get; init; }
    public string City { get; init; }
    public string Zip { get; init; }
    public string Country { get; init; }
}

// AFTER: Extracted ValueObject
public class Address : ValueObject
{
    public string Street { get; }
    public string City { get; }
    public string Zip { get; }
    public string Country { get; }

    private Address(string street, string city, string zip, string country) { /* ... */ }

    public static Result<Address, Error> Create(string street, string city, string zip, string country)
    {
        // Validate all fields
        return new Address(street, city, zip, country);
    }

    protected override IEnumerable<IComparable> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
        yield return Zip;
        yield return Country;
    }
}

public class Customer { public Address Address { get; init; } }
public class Warehouse { public Address Address { get; init; } }
```

**Refactoring techniques**: Extract Class (ValueObject), Introduce Parameter Object, Preserve Whole Object.

---

## Category 2: Object-Orientation Abusers

Incomplete or incorrect application of OO principles.

### 6. Switch Statements

**Detection heuristics**:
- `switch`/`if-else` chain on type or enum duplicated across 2+ methods
- `switch` with 5+ cases containing logic (not just mapping)
- `is` type checks in sequence

**C# fix patterns**:

```csharp
// ACCEPTABLE: Single dispatch point with pattern matching
public decimal CalculateDiscount(Order order) => order.CustomerType switch
{
    CustomerType.Regular => 0m,
    CustomerType.Premium => order.Total * 0.1m,
    CustomerType.VIP => order.Total * 0.2m,
    _ => 0m
};

// SMELL: Same switch duplicated in CalculateDiscount, CalculateShipping, GetWelcomeMessage
// FIX: Polymorphism or strategy
public interface ICustomerStrategy
{
    decimal CalculateDiscount(Order order);
    decimal CalculateShipping(Order order);
    string GetWelcomeMessage();
}

public class VipCustomerStrategy : ICustomerStrategy { /* ... */ }
public class PremiumCustomerStrategy : ICustomerStrategy { /* ... */ }
```

**Refactoring techniques**: Replace Conditional with Polymorphism, Replace Type Code with Strategy, Extract Method.

---

### 7. Temporary Field

**Detection heuristics**:
- Fields that are `null`/default in most code paths
- Fields set only in specific methods, not in constructor
- Fields guarded by null checks before use

**C# fix patterns**:

```csharp
// BEFORE: Temporary fields
public class ReportGenerator
{
    private IEnumerable<Transaction>? _transactions; // Only set in GenerateMonthly
    private DateTime? _startDate;                     // Only set in GenerateMonthly
    private DateTime? _endDate;                       // Only set in GenerateMonthly

    public Report GenerateMonthly(DateTime month) { /* sets fields, then uses them */ }
    public Report GenerateYearly(DateTime year) { /* different fields entirely */ }
}

// AFTER: Extract into focused class or use Maybe<T>
public class MonthlyReportGenerator
{
    private readonly IEnumerable<Transaction> _transactions;
    private readonly DateTime _startDate;
    private readonly DateTime _endDate;

    public MonthlyReportGenerator(IEnumerable<Transaction> transactions, DateTime start, DateTime end)
    {
        _transactions = transactions;
        _startDate = start;
        _endDate = end;
    }

    public Report Generate() { /* all fields always valid */ }
}
```

**Refactoring techniques**: Extract Class, Introduce Null Object (Maybe<T>), Replace Method with Method Object.

---

### 8. Refused Bequest

**Detection heuristics**:
- Subclass overrides parent method to throw `NotSupportedException`
- Subclass overrides method with empty body or no-op
- Subclass uses <50% of inherited members
- LSP violations (substituting child breaks parent's contract)

**C# fix patterns**:

```csharp
// BEFORE: Refused bequest
public class ReadOnlyRepository : Repository
{
    public override void Save(Entity entity) =>
        throw new NotSupportedException(); // Refuses inherited behavior

    public override void Delete(int id) =>
        throw new NotSupportedException(); // Refuses inherited behavior
}

// AFTER: Interface segregation
public interface IReadRepository
{
    Task<Maybe<Entity>> FindByIdAsync(int id, CancellationToken ct);
    Task<IReadOnlyList<Entity>> GetAllAsync(CancellationToken ct);
}

public interface IWriteRepository : IReadRepository
{
    Task SaveAsync(Entity entity, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}
```

**Refactoring techniques**: Replace Inheritance with Delegation, Extract Interface, Push Down Method.

---

### 9. Alternative Classes with Different Interfaces

**Detection heuristics**:
- Two classes with similar functionality but different method names
- Classes that could be used interchangeably if interfaces were aligned
- Wrapper classes that adapt one interface to another's shape

**C# fix patterns**:

```csharp
// BEFORE: Same concept, different interfaces
public class EmailNotifier
{
    public void SendEmail(string to, string subject, string body) { }
}

public class SmsNotifier
{
    public void DispatchSms(string phoneNumber, string message) { }
}

// AFTER: Common interface
public interface INotifier
{
    Task<Result<Unit, Error>> SendAsync(Recipient recipient, NotificationContent content, CancellationToken ct);
}

public class EmailNotifier : INotifier { /* ... */ }
public class SmsNotifier : INotifier { /* ... */ }
```

**Refactoring techniques**: Rename Method, Extract Superclass, Extract Interface.

---

## Category 3: Change Preventers

Smells that force widespread changes whenever one thing is modified.

### 10. Divergent Change

**Detection heuristics**:
- Class modified in multiple PRs for unrelated features
- Class has methods grouped by different concerns (half for orders, half for invoicing)
- `git log --follow` shows modifications for 3+ different reasons

**C# fix patterns**:

```csharp
// BEFORE: Class changes for multiple reasons
public class InvoiceService
{
    public Invoice CreateInvoice(Order order) { /* creation logic */ }
    public byte[] GeneratePdf(Invoice invoice) { /* PDF rendering */ }
    public Result<Unit, Error> SendToCustomer(Invoice invoice) { /* email sending */ }
    public void RecordPayment(Invoice invoice, Payment payment) { /* payment processing */ }
}

// AFTER: Split by reason for change
public class CreateInvoiceHandler : ICommandHandler<CreateInvoiceCommand, Invoice> { }
public class InvoicePdfGenerator { }
public class InvoiceEmailSender { }
public class RecordPaymentHandler : ICommandHandler<RecordPaymentCommand, Unit> { }
```

**Refactoring techniques**: Extract Class, Extract Method, Vertical Slice Architecture.

---

### 11. Shotgun Surgery

**Severity**: CRITICAL

**Detection heuristics**:
- Adding a field to a domain entity requires changes in 4+ files (entity, DTO, mapper, validator, handler, endpoint)
- A new feature flag requires touching 5+ classes
- Config changes propagate across layers

**C# fix patterns**:

```csharp
// BEFORE: Adding "MiddleName" requires changes in:
// User.cs, UserDto.cs, UserMapper.cs, UserValidator.cs,
// CreateUserHandler.cs, UpdateUserHandler.cs, UserEndpoint.cs

// AFTER: Vertical slice — all user creation in one place
Features/Users/CreateUser/
    CreateUserCommand.cs      // includes all fields
    CreateUserHandler.cs      // maps, validates, persists
    CreateUserEndpoint.cs     // HTTP mapping

// Changes to user creation only touch files in this folder
```

**Refactoring techniques**: Move Method, Move Field, Inline Class, Vertical Slices.

---

### 12. Parallel Inheritance Hierarchies

**Detection heuristics**:
- Creating a subclass of `X` always requires creating a subclass of `Y`
- Matching hierarchies: `OrderValidator` for each `Order` subtype
- Mirror class names with consistent suffixes

**C# fix patterns**:

```csharp
// BEFORE: Parallel hierarchies
public class DomesticOrder : Order { }
public class InternationalOrder : Order { }
public class DomesticShippingCalculator : ShippingCalculator { }
public class InternationalShippingCalculator : ShippingCalculator { }

// AFTER: Composition — shipping strategy injected
public class Order
{
    public IShippingStrategy ShippingStrategy { get; init; }
    public decimal CalculateShipping() => ShippingStrategy.Calculate(this);
}
```

**Refactoring techniques**: Move Method, Move Field — collapse one hierarchy by moving behavior into the other.

---

## Category 4: Dispensables

Pointless code whose removal would improve clarity.

### 13. Comments

**Detection heuristics**:
- Comments that explain *what* code does (vs. *why*)
- Commented-out code blocks
- TODO comments older than 30 days
- Comments contradicting the code

**C# fix patterns**:

```csharp
// SMELL: Comment explaining what
// Check if user is active and has permission to place orders
if (user.Status == UserStatus.Active && user.Permissions.Contains("orders.create"))

// FIX: Self-documenting code
if (user.CanPlaceOrders())

// ACCEPTABLE: Comment explaining why
// Using raw SQL here because EF Core doesn't support MERGE with OUTPUT
await _db.Database.ExecuteSqlInterpolatedAsync(mergeQuery, ct);

// ACCEPTABLE: XML doc comments on public API
/// <summary>Creates a new user from the given command.</summary>
public Task<Result<UserId, Error>> HandleAsync(CreateUserCommand command, CancellationToken ct);
```

**Refactoring techniques**: Extract Method (with descriptive name), Rename Method, Rename Variable.

---

### 14. Duplicate Code

**Severity**: CRITICAL

**Threshold**: 5+ identical or near-identical lines

**Detection heuristics**:
- Copy-pasted code blocks
- Similar Result chain patterns repeated across handlers
- Identical validation logic in multiple places
- Same LINQ query in different methods

**C# fix patterns**:

```csharp
// BEFORE: Duplicated validation in multiple handlers
// In CreateUserHandler:
var emailResult = Email.Create(cmd.Email);
if (emailResult.IsFailure) return emailResult.Error;
var exists = await _repo.ExistsAsync(emailResult.Value, ct);
if (exists) return DomainErrors.User.DuplicateEmail(cmd.Email);

// Same 4 lines in UpdateUserEmailHandler

// AFTER: Extract shared method
private async Task<Result<Email, Error>> ValidateUniqueEmail(string rawEmail, CancellationToken ct)
{
    return await Email.Create(rawEmail)
        .Bind(async email =>
        {
            var exists = await _repo.ExistsAsync(email, ct);
            return exists
                ? Result.Failure<Email, Error>(DomainErrors.User.DuplicateEmail(rawEmail))
                : Result.Success<Email, Error>(email);
        });
}
```

**Refactoring techniques**: Extract Method, Extract Class, Pull Up Method, Form Template Method.

---

### 15. Lazy Class

**Detection heuristics**:
- Class with 1-2 methods and 0-1 fields
- Class that only wraps a single call
- Class created "for future extensibility" but never extended

**C# fix patterns**:

```csharp
// SMELL: Class doing almost nothing
public class DateFormatter
{
    public string Format(DateTime date) => date.ToString("yyyy-MM-dd");
}

// FIX: Inline as extension method or static helper
public static class DateExtensions
{
    public static string ToIso(this DateTime date) => date.ToString("yyyy-MM-dd");
}
```

**Exception**: ValueObjects with `Create()` factory are NOT lazy — they encapsulate validation.

**Refactoring techniques**: Inline Class, Collapse Hierarchy.

---

### 16. Data Class

**Detection heuristics**:
- Class with only properties (no methods beyond getters/setters)
- Entity with public setters and no behavior
- "Anemic domain model" — logic lives in services, not entities

**C# fix patterns**:

```csharp
// SMELL: Anemic entity — all logic in service
public class Order
{
    public OrderStatus Status { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
}

public class OrderService
{
    public void CancelOrder(Order order, string reason)
    {
        order.Status = OrderStatus.Cancelled;
        order.CancelledAt = DateTime.UtcNow;
        order.CancelReason = reason;
    }
}

// FIX: Rich domain model — Tell Don't Ask
public class Order
{
    public OrderStatus Status { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public string? CancelReason { get; private set; }

    public Result<Unit, Error> Cancel(string reason)
    {
        if (Status != OrderStatus.Active)
            return DomainErrors.Order.CannotCancel(Status);
        Status = OrderStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        CancelReason = reason;
        return Unit.Default;
    }
}
```

**Exception**: `record` types for DTOs, commands, queries, and responses are NOT data class smells — they are the correct pattern.

**Refactoring techniques**: Move Method (from service into entity), Encapsulate Field, Encapsulate Collection.

---

### 17. Dead Code

**Detection heuristics**:
- Unused private methods (no callers)
- Unreachable `else` branches
- Commented-out code blocks
- Unused parameters (especially after refactoring)
- `#if false` blocks
- Methods with `[Obsolete]` and zero callers

**Fix**: Delete it. Git preserves history. Do not comment out — delete.

**Refactoring techniques**: Remove Dead Code, Remove Parameter, Collapse Hierarchy.

---

### 18. Speculative Generality

**Detection heuristics**:
- Abstract class with exactly 1 subclass
- Interface with exactly 1 implementation (and no test mock)
- Generic method `<T>` called with only 1 type
- Parameters, fields, or methods that are never used
- "Helper" or "Utility" classes created "just in case"
- Feature flags for unreleased features older than 90 days

**C# fix patterns**:

```csharp
// SMELL: Premature abstraction
public interface IOrderProcessor { }
public class OrderProcessor : IOrderProcessor { } // Only implementation

// FIX: Remove interface, use concrete class
// Re-introduce interface when a second implementation actually exists
// Exception: interfaces needed for testing (NSubstitute) are acceptable
public class OrderProcessor { }
```

**Exception**: Interfaces for DI boundaries that enable NSubstitute mocking in tests are acceptable even with 1 implementation.

**Refactoring techniques**: Collapse Hierarchy, Inline Class, Remove Parameter.

---

## Category 5: Couplers

Smells causing excessive coupling or over-delegation.

### 19. Feature Envy

**Severity**: CRITICAL

**Detection heuristics**:
- Method accesses 3+ members of another class
- Method uses more data from another class than its own
- Method could be moved to the other class and would reference fewer external objects

**C# fix patterns**:

```csharp
// SMELL: Method envies Order's data
public class InvoiceGenerator
{
    public decimal CalculateTotal(Order order)
    {
        var subtotal = order.Lines.Sum(l => l.Price * l.Quantity);
        var discount = order.Customer.IsVip ? subtotal * 0.1m : 0m;
        var tax = (subtotal - discount) * order.TaxRate;
        return subtotal - discount + tax;
    }
}

// FIX: Move calculation to Order
public class Order
{
    public decimal CalculateTotal()
    {
        var subtotal = Lines.Sum(l => l.Price * l.Quantity);
        var discount = Customer.IsVip ? subtotal * 0.1m : 0m;
        var tax = (subtotal - discount) * TaxRate;
        return subtotal - discount + tax;
    }
}
```

**Refactoring techniques**: Move Method, Extract Method.

---

### 20. Inappropriate Intimacy

**Detection heuristics**:
- Class accessing `internal` members of another class
- Classes in different namespaces using `[InternalsVisibleTo]`
- Bidirectional references between classes
- Class directly manipulating another class's private state via reflection

**C# fix patterns**:

```csharp
// SMELL: Bidirectional coupling
public class Order
{
    public Customer Customer { get; set; }
    public void UpdateCustomerBalance() => Customer.Balance -= Total; // Reaching into Customer
}

public class Customer
{
    public decimal Balance { get; set; }
    public List<Order> Orders { get; set; } // Customer knows about Order too
}

// FIX: Unidirectional, through interfaces
public class Order
{
    public CustomerId CustomerId { get; init; } // ID only, not full reference
}

public class Customer
{
    public Result<Unit, Error> DeductBalance(Money amount) { /* encapsulated */ }
}

// Coordination happens in handler, not between entities
```

**Refactoring techniques**: Move Method, Move Field, Extract Class, Hide Delegate, Replace Inheritance with Delegation.

---

### 21. Message Chains

**Detection heuristics**:
- `a.GetB().GetC().GetD()` call chains (3+ levels)
- Navigation through object graph: `order.Customer.Address.City`
- Repeated chain in multiple places

**C# fix patterns**:

```csharp
// SMELL: Long navigation chain
var city = order.Customer.Address.City;
var zip = order.Customer.Address.Zip;

// FIX: Expose what's needed at appropriate level
public class Order
{
    public Address ShippingAddress { get; init; } // Flattened access
}

// Or use a dedicated query/projection
public record OrderShippingInfo(string City, string Zip);
```

**Exception**: LINQ fluent chains (`.Where().Select().ToList()`) are NOT message chains — they operate on the same data.

**Refactoring techniques**: Hide Delegate, Extract Method, Move Method.

---

### 22. Middle Man

**Detection heuristics**:
- Class where >50% of methods just delegate to another object
- Wrapper that adds no logic, just passes through
- "Service" that only calls one repository method per handler method

**C# fix patterns**:

```csharp
// SMELL: Pure delegation
public class UserService
{
    private readonly IUserRepository _repo;
    public Task<Maybe<User>> FindById(UserId id, CancellationToken ct) => _repo.FindById(id, ct);
    public Task Add(User user, CancellationToken ct) => _repo.Add(user, ct);
    public Task<bool> Exists(Email email, CancellationToken ct) => _repo.Exists(email, ct);
}

// FIX: Inject IUserRepository directly where needed
public class CreateUserHandler
{
    private readonly IUserRepository _repo; // Direct dependency, no middle man
}
```

**Exception**: Decorator pattern adding cross-cutting concerns (caching, logging) is NOT a middle man.

**Refactoring techniques**: Remove Middle Man, Inline Method.

---

### 23. Incomplete Library Class

**Detection heuristics**:
- Workaround code wrapping library calls
- Utility class extending library functionality
- Comments like "library doesn't support X"

**C# fix patterns**:

```csharp
// FIX: Extension method
public static class StringExtensions
{
    public static string Truncate(this string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength] + "...";
}

// FIX: Adapter for missing interface
public class LibraryAdapter : IExpectedInterface
{
    private readonly ThirdPartyLib _lib;
    public LibraryAdapter(ThirdPartyLib lib) => _lib = lib;
    public Result<Data, Error> Process(Input input) => /* adapt */;
}
```

**Refactoring techniques**: Introduce Foreign Method (extension method), Introduce Local Extension (adapter/decorator).
