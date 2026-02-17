---
name: domain-events-patterns
description: Domain event patterns — creating events, raising from aggregate roots, dispatching and clearing, handler registration, application vs domain events, and testing dispatch verification. Use when implementing domain events, adding event handlers, or testing event-driven behavior in VSTO or Clean Architecture codebases.
---

# Domain Event Patterns

How to create, raise, dispatch, and test domain events in a Clean Architecture / VSTO codebase.

## When to Activate

- Creating new domain events
- Raising events from aggregate roots
- Implementing domain event handlers
- Setting up event dispatch in the pipeline
- Testing that events are dispatched correctly
- Understanding application vs domain events

## Creating Domain Events

### Naming Convention

Events describe something that **happened** — past tense, domain language:

```csharp
// Good: Past tense, describes what happened
public sealed record HeaderInsertedEvent(string DocumentPath, string HeaderText) : IDomainEvent;
public sealed record DocumentPropertyChangedEvent(string DocumentPath, string Key, string Value) : IDomainEvent;
public sealed record ContentControlRemovedEvent(string ControlId, string Tag) : IDomainEvent;

// Bad: Imperative or vague naming
public sealed record InsertHeaderEvent(...);     // ← Not past tense
public sealed record DataChangedEvent(...);       // ← Too vague
public sealed record HeaderEvent(...);            // ← No verb
```

### Event Base Interface

```csharp
public interface IDomainEvent
{
    DateTime OccurredOn { get; }
}

// Default implementation via base record
public abstract record DomainEvent : IDomainEvent
{
    public DateTime OccurredOn { get; init; } = DateTime.UtcNow;
}
```

### Event Structure

Events are **immutable records** containing only the data needed by handlers:

```csharp
public sealed record DocumentExportedEvent(
    string DocumentPath,
    string ExportFormat,
    int PageCount) : DomainEvent;

public sealed record LicenseValidatedEvent(
    string Feature,
    bool IsEntitled) : DomainEvent;
```

**Rules**:
- Use primitive types or value objects (no entities, no COM objects)
- Include enough context for handlers to act without querying
- Keep events small — split large events into multiple focused ones

## Raising Events from Aggregate Roots

### AggregateRoot Base Class

```csharp
public abstract class AggregateRoot
{
    private readonly List<IDomainEvent> _domainEvents = new();

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void RaiseDomainEvent(IDomainEvent domainEvent)
    {
        _domainEvents.Add(domainEvent);
    }

    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }
}
```

### Raising in Domain Methods

Events are raised **inside domain methods** as side effects of state changes:

```csharp
public sealed class Document : AggregateRoot
{
    public Result<Unit, Error> SetProperty(string key, string value)
    {
        if (string.IsNullOrWhiteSpace(key))
            return DomainErrors.Document.InvalidPropertyKey;

        Properties.Set(key, value);

        // Raise event after state change succeeds
        RaiseDomainEvent(new DocumentPropertyChangedEvent(Path, key, value));

        return Unit.Default;
    }

    public Result<Unit, Error> MarkAsExported(string format, int pageCount)
    {
        Status = DocumentStatus.Exported;

        RaiseDomainEvent(new DocumentExportedEvent(Path, format, pageCount));

        return Unit.Default;
    }
}
```

**Rules**:
- Raise events **after** the state change, not before
- Only raise if the operation **succeeds** (inside the success path)
- Events accumulate until explicitly dispatched and cleared

## Dispatching Events

### IDomainEventDispatcher

```csharp
public interface IDomainEventDispatcher
{
    Task DispatchAndClear(AggregateRoot aggregateRoot);
}
```

### Implementation

```csharp
public sealed class DomainEventDispatcher : IDomainEventDispatcher
{
    private readonly IServiceProvider _serviceProvider;

    public DomainEventDispatcher(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task DispatchAndClear(AggregateRoot aggregateRoot)
    {
        var events = aggregateRoot.DomainEvents.ToList();
        aggregateRoot.ClearDomainEvents();

        foreach (var domainEvent in events)
        {
            var handlerType = typeof(IDomainEventHandler<>)
                .MakeGenericType(domainEvent.GetType());

            var handlers = _serviceProvider.GetServices(handlerType);

            foreach (var handler in handlers)
            {
                await ((dynamic)handler).Handle((dynamic)domainEvent);
            }
        }
    }
}
```

### Dispatch in Handler (After Successful Operation)

```csharp
public sealed class SetDocumentPropertyHandler(
    IDocumentEditor editor,
    IDomainEventDispatcher dispatcher)
    : ICommandHandler<SetDocumentPropertyCommand, Unit>
{
    public async Task<Result<Unit, Error>> Handle(
        SetDocumentPropertyCommand command, CancellationToken ct)
    {
        var document = editor.GetDocument();

        var result = document.SetProperty(command.Key, command.Value);
        if (result.IsFailure)
            return result.Error;

        // Persist changes via interop
        var persistResult = editor.SaveProperties(document.Properties);
        if (persistResult.IsFailure)
            return persistResult.Error;

        // Dispatch accumulated events
        await dispatcher.DispatchAndClear(document);

        return Unit.Default;
    }
}
```

### DispatchAndClear Pattern

The `DispatchAndClear` contract:
1. **Copy** events from aggregate
2. **Clear** events on aggregate (prevents double-dispatch)
3. **Dispatch** each event to registered handlers
4. If dispatch fails, events are already cleared (no retry by default)

## Domain Event Handlers

### Interface

```csharp
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    Task Handle(TEvent domainEvent);
}
```

### Implementation

```csharp
public sealed class OnHeaderInserted_UpdateDocumentIndex
    : IDomainEventHandler<HeaderInsertedEvent>
{
    private readonly IDocumentIndex _index;

    public OnHeaderInserted_UpdateDocumentIndex(IDocumentIndex index)
    {
        _index = index;
    }

    public async Task Handle(HeaderInsertedEvent domainEvent)
    {
        await _index.AddEntry(domainEvent.DocumentPath, domainEvent.HeaderText);
    }
}
```

### Naming Convention

`On{EventName}_{WhatItDoes}`:
- `OnHeaderInserted_UpdateDocumentIndex`
- `OnDocumentExported_LogExport`
- `OnLicenseValidated_CacheResult`

### Registration

```csharp
// Register as singletons (stateless handlers)
services.AddSingleton<IDomainEventHandler<HeaderInsertedEvent>,
    OnHeaderInserted_UpdateDocumentIndex>();

services.AddSingleton<IDomainEventHandler<DocumentExportedEvent>,
    OnDocumentExported_LogExport>();

// Multiple handlers for same event
services.AddSingleton<IDomainEventHandler<HeaderInsertedEvent>,
    OnHeaderInserted_NotifyStatusBar>();
```

## Application vs Domain Events

| Aspect | Domain Event | Application Event |
|--------|-------------|-------------------|
| **Scope** | Within bounded context | Cross-cutting / infrastructure |
| **Raised by** | Aggregate root | Application service / decorator |
| **Examples** | `HeaderInsertedEvent`, `PropertyChangedEvent` | `CommandExecutedEvent`, `PerformanceLogEvent` |
| **Handlers** | Domain/Application layer | Infrastructure layer |
| **Timing** | After domain state change | After pipeline completion |

### Application Events (Cross-Cutting)

```csharp
// These are NOT domain events — they're pipeline/infrastructure concerns
public sealed record CommandExecutedEvent(
    string CommandName,
    TimeSpan Duration,
    bool Success) : IApplicationEvent;

public sealed record UndoBatchCompletedEvent(
    string CommandName,
    int OperationCount) : IApplicationEvent;
```

Application events are raised by **decorators**, not by domain entities.

## Testing Domain Events

### Verify Event Was Raised

```csharp
[Fact]
public void SetProperty_Success_RaisesPropertyChangedEvent()
{
    var document = DocumentBuilder.Create()
        .WithPath("/test.docx")
        .Build();

    document.SetProperty("Author", "Jane");

    document.DomainEvents.Should().ContainSingle()
        .Which.Should().BeOfType<DocumentPropertyChangedEvent>()
        .Which.Should().BeEquivalentTo(new
        {
            DocumentPath = "/test.docx",
            Key = "Author",
            Value = "Jane"
        });
}
```

### Verify No Event on Failure

```csharp
[Fact]
public void SetProperty_InvalidKey_RaisesNoEvent()
{
    var document = DocumentBuilder.Create().Build();

    var result = document.SetProperty("", "value");

    result.IsFailure.Should().BeTrue();
    document.DomainEvents.Should().BeEmpty();
}
```

### Verify Dispatch in Handler Test

```csharp
[Fact]
public async Task Handle_Success_DispatchesEvents()
{
    var dispatcher = Substitute.For<IDomainEventDispatcher>();
    var editor = Substitute.For<IDocumentEditor>();

    editor.GetDocument().Returns(DocumentBuilder.Create()
        .WithPath("/test.docx").Build());
    editor.SaveProperties(Arg.Any<CustomProperties>())
        .Returns(Result.Success<Unit, Error>(Unit.Default));

    var handler = new SetDocumentPropertyHandler(editor, dispatcher);

    await handler.Handle(
        new SetDocumentPropertyCommand("Author", "Jane"),
        CancellationToken.None);

    await dispatcher.Received(1).DispatchAndClear(
        Arg.Is<AggregateRoot>(a =>
            a.DomainEvents.Count == 0)); // Already cleared by DispatchAndClear
}
```

### BDD Feature for Events

```gherkin
Feature: Document property changes raise events

  Scenario: Setting a property raises a property changed event
    Given a document at path "/report.docx"
    When I set property "Author" to "Jane"
    Then a DocumentPropertyChangedEvent should be raised
    And the event should contain key "Author" and value "Jane"

  Scenario: Invalid property key raises no event
    Given a document at path "/report.docx"
    When I set property "" to "value"
    Then no domain events should be raised
    And the operation fails because the property key is invalid
```

## Integration with Existing Skills

- **csharp-patterns**: AggregateRoot, Result/Maybe patterns used in event raising
- **vsto-testing**: BDD patterns for testing event dispatch
- **office-document-patterns**: Document aggregate root where events originate
- **decorator-chain-patterns**: Application events raised by decorators
