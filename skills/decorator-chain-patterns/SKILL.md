---
name: decorator-chain-patterns
description: CQS decorator chain patterns with Scrutor — ordering, creating new decorators, attribute-driven behavior, DecoratorHelpers, and BDD verification. Use when adding new decorators, modifying decorator order, understanding the command/query pipeline, or testing decorator chain behavior.
---

# CQS Decorator Chain Patterns

How the command/query handler decorator pipeline works — Scrutor registration, creating new decorators, attribute inspection, and BDD verification.

## When to Activate

- Adding a new decorator to the CQS pipeline
- Modifying decorator registration order
- Understanding how requests flow through the decorator chain
- Testing decorator chain ordering with BDD
- Using `DecoratorHelpers` for attribute inspection

## How Scrutor Decoration Works

Scrutor's `.Decorate()` wraps the **current** registration. Each call wraps the previous, so **last registered = outermost** in execution.

```csharp
// Registration order (inside → out)
services.AddScoped(typeof(ICommandHandler<,>), typeof(CommandHandler<,>));

services.Decorate(typeof(ICommandHandler<,>), typeof(InnerDecorator<,>));   // Wraps handler
services.Decorate(typeof(ICommandHandler<,>), typeof(OuterDecorator<,>));   // Wraps InnerDecorator

// Execution order (outside → in)
// Request → OuterDecorator → InnerDecorator → Handler → Response
```

### Mental Model

Think of it like Russian dolls — each `.Decorate()` adds an outer layer:

```
services.Decorate(A)  →  [A → Handler]
services.Decorate(B)  →  [B → A → Handler]
services.Decorate(C)  →  [C → B → A → Handler]

Execution: C → B → A → Handler
```

## Creating New Decorators

### Command Decorator Template

```csharp
public sealed class MyBehaviorDecorator<TCommand, TResponse>
    : ICommandHandler<TCommand, TResponse>
    where TCommand : ICommand<TResponse>
{
    private readonly ICommandHandler<TCommand, TResponse> _inner;
    private readonly ILogger<MyBehaviorDecorator<TCommand, TResponse>> _logger;

    public MyBehaviorDecorator(
        ICommandHandler<TCommand, TResponse> inner,
        ILogger<MyBehaviorDecorator<TCommand, TResponse>> logger)
    {
        _inner = inner;
        _logger = logger;
    }

    public async Task<Result<TResponse, Error>> Handle(
        TCommand command, CancellationToken ct)
    {
        // Pre-processing
        _logger.LogInformation("Before: {Command}", typeof(TCommand).Name);

        // Delegate to inner handler
        var result = await _inner.Handle(command, ct);

        // Post-processing
        _logger.LogInformation("After: {Command} → {Success}",
            typeof(TCommand).Name, result.IsSuccess);

        return result;
    }
}
```

### Query Decorator Template

```csharp
public sealed class MyBehaviorDecorator<TQuery, TResponse>
    : IQueryHandler<TQuery, TResponse>
    where TQuery : IQuery<TResponse>
{
    private readonly IQueryHandler<TQuery, TResponse> _inner;

    public MyBehaviorDecorator(IQueryHandler<TQuery, TResponse> inner)
    {
        _inner = inner;
    }

    public async Task<Result<TResponse, Error>> Handle(
        TQuery query, CancellationToken ct)
    {
        // Pre-processing
        var result = await _inner.Handle(query, ct);
        // Post-processing
        return result;
    }
}
```

### Registration

```csharp
// Add to DI after existing decorators, in the correct position
services.Decorate(typeof(ICommandHandler<,>), typeof(MyBehaviorDecorator<,>));
services.Decorate(typeof(IQueryHandler<,>), typeof(MyBehaviorDecorator<,>));
```

## Attribute-Driven Behavior

Decorators can conditionally execute based on attributes on the **inner handler**.

### Common Attributes

```csharp
[AttributeUsage(AttributeTargets.Class)]
public sealed class DocumentRequiredAttribute : Attribute;

[AttributeUsage(AttributeTargets.Class)]
public sealed class RequireEntitlementAttribute : Attribute
{
    public string Feature { get; }
    public RequireEntitlementAttribute(string feature = "") => Feature = feature;
}

[AttributeUsage(AttributeTargets.Class)]
public sealed class SkipLoggingAttribute : Attribute;
```

### DecoratorHelpers — Inspecting the Inner Handler

```csharp
public static class DecoratorHelpers
{
    /// <summary>
    /// Walks the decorator chain to find the actual handler type (the non-decorator).
    /// </summary>
    public static Type GetInnerHandlerType<TCommand, TResponse>(
        ICommandHandler<TCommand, TResponse> handler)
        where TCommand : ICommand<TResponse>
    {
        var current = handler;
        while (current is IDecoratorMarker<TCommand, TResponse> decorator)
        {
            current = decorator.Inner;
        }
        return current.GetType();
    }

    /// <summary>
    /// Checks if the inner handler has a specific attribute.
    /// </summary>
    public static bool HasAttribute<TAttribute>(Type handlerType)
        where TAttribute : Attribute =>
        handlerType.GetCustomAttribute<TAttribute>() != null;

    /// <summary>
    /// Gets a specific attribute from the inner handler.
    /// </summary>
    public static TAttribute? GetAttribute<TAttribute>(Type handlerType)
        where TAttribute : Attribute =>
        handlerType.GetCustomAttribute<TAttribute>();
}
```

### Using in a Decorator

```csharp
public sealed class DocumentRequiredDecorator<TCommand, TResponse>
    : ICommandHandler<TCommand, TResponse>, IDecoratorMarker<TCommand, TResponse>
    where TCommand : ICommand<TResponse>
{
    private readonly ICommandHandler<TCommand, TResponse> _inner;
    private readonly IWordApplication _application;

    public ICommandHandler<TCommand, TResponse> Inner => _inner;

    public DocumentRequiredDecorator(
        ICommandHandler<TCommand, TResponse> inner,
        IWordApplication application)
    {
        _inner = inner;
        _application = application;
    }

    public async Task<Result<TResponse, Error>> Handle(
        TCommand command, CancellationToken ct)
    {
        var handlerType = DecoratorHelpers.GetInnerHandlerType(_inner);

        // Skip if handler doesn't require a document
        if (!DecoratorHelpers.HasAttribute<DocumentRequiredAttribute>(handlerType))
            return await _inner.Handle(command, ct);

        // Enforce document requirement
        var activeDoc = _application.ActiveDocument;
        if (activeDoc.HasNoValue)
            return DomainErrors.Document.NotActive;

        return await _inner.Handle(command, ct);
    }
}
```

## Standard Decorator Chain

### Recommended Order

| Position | Decorator | Purpose |
|----------|-----------|---------|
| 1 (outermost) | `LoggingDecorator` | Log entry/exit, timing, errors |
| 2 | `DocumentContextDecorator` | Set up document context for pipeline |
| 3 | `LicensingDecorator` | Check feature entitlement |
| 4 | `DocumentRequiredDecorator` | Verify active document exists |
| 5 | `PerformanceDecorator` | Measure handler execution time |
| 6 (innermost) | `UndoBatchDecorator` | Wrap handler in undo batch |

### Why This Order

- **Logging outermost**: Captures everything including decorator failures
- **DocumentContext before Licensing**: License check may need document info
- **Licensing before DocumentRequired**: Don't check document if feature is unlicensed (fail fast)
- **Performance near inner**: Measures actual handler work, not cross-cutting overhead
- **Undo innermost**: Only wraps the handler's actual document mutations

### Registration Code

```csharp
public static IServiceCollection AddDecoratorChain(this IServiceCollection services)
{
    // Base handlers
    services.AddScoped(typeof(ICommandHandler<,>), typeof(CommandHandler<,>));
    services.AddScoped(typeof(IQueryHandler<,>), typeof(QueryHandler<,>));

    // Command decorators (inside → out)
    services.Decorate(typeof(ICommandHandler<,>), typeof(UndoBatchDecorator<,>));
    services.Decorate(typeof(ICommandHandler<,>), typeof(PerformanceDecorator<,>));
    services.Decorate(typeof(ICommandHandler<,>), typeof(DocumentRequiredDecorator<,>));
    services.Decorate(typeof(ICommandHandler<,>), typeof(LicensingDecorator<,>));
    services.Decorate(typeof(ICommandHandler<,>), typeof(DocumentContextDecorator<,>));
    services.Decorate(typeof(ICommandHandler<,>), typeof(LoggingDecorator<,>));

    // Query decorators (typically fewer — no undo, no document mutation)
    services.Decorate(typeof(IQueryHandler<,>), typeof(PerformanceDecorator<,>));
    services.Decorate(typeof(IQueryHandler<,>), typeof(LicensingDecorator<,>));
    services.Decorate(typeof(IQueryHandler<,>), typeof(LoggingDecorator<,>));

    return services;
}
```

## BDD Verification — DecoratorChainOrder.feature

```gherkin
Feature: Decorator chain ordering

  Rule: Command decorators execute in the correct order

    Scenario: Command pipeline executes decorators outside-in
      Given the command decorator chain is registered
      When I resolve an ICommandHandler<TestCommand, Unit>
      Then the decorator execution order should be:
        | Decorator                  |
        | LoggingDecorator           |
        | DocumentContextDecorator   |
        | LicensingDecorator         |
        | DocumentRequiredDecorator  |
        | PerformanceDecorator       |
        | UndoBatchDecorator         |
        | TestCommandHandler         |

    Scenario: Query pipeline has no undo decorator
      Given the query decorator chain is registered
      When I resolve an IQueryHandler<TestQuery, string>
      Then the decorator execution order should be:
        | Decorator             |
        | LoggingDecorator      |
        | LicensingDecorator    |
        | PerformanceDecorator  |
        | TestQueryHandler      |
```

### Step Definitions for Chain Verification

```csharp
[Binding]
public sealed class DecoratorChainSteps(SharedContext context)
{
    private IServiceProvider _provider = null!;

    [Given("the command decorator chain is registered")]
    public void GivenCommandChainRegistered()
    {
        var services = new ServiceCollection();
        services.AddScoped<ICommandHandler<TestCommand, Unit>, TestCommandHandler>();
        services.AddDecoratorChain();
        _provider = services.BuildServiceProvider();
    }

    [When("I resolve an ICommandHandler<TestCommand, Unit>")]
    public void WhenResolveCommandHandler()
    {
        var handler = _provider.GetRequiredService<ICommandHandler<TestCommand, Unit>>();
        context.ResolvedHandler = handler;
    }

    [Then("the decorator execution order should be:")]
    public void ThenDecoratorOrder(Table table)
    {
        var expected = table.Rows.Select(r => r["Decorator"]).ToList();
        var actual = UnwrapDecoratorChain(context.ResolvedHandler);

        actual.Should().BeEquivalentTo(expected, o => o.WithStrictOrdering());
    }

    private static List<string> UnwrapDecoratorChain<T>(T handler)
    {
        var chain = new List<string>();
        object current = handler!;

        while (current is IDecoratorMarker marker)
        {
            chain.Add(current.GetType().Name.Split('`')[0]);
            current = marker.InnerObject;
        }

        chain.Add(current.GetType().Name);
        return chain;
    }
}
```

## Integration with Existing Skills

- **vsto-architecture-enforcer**: Enforces decorator ordering rules at review time
- **csharp-patterns**: Result/Maybe patterns used in decorator return types
- **vsto-testing**: BDD patterns for testing the decorator chain
- **office-document-patterns**: Decorators interact with document abstractions (IDocumentEditor, IWordApplication)
