---
name: vsto-testing
description: VSTO TDD and BDD testing patterns with Reqnroll, COM testability through interface wrapping, handler test patterns, and ArchUnitNET conventions. Extends csharp-testing with Office-specific testing knowledge. Use when writing tests for VSTO add-ins, Reqnroll features, COM-wrapped interfaces, or CQS handler tests.
---

# VSTO Testing Patterns

Testing patterns specific to VSTO/Office add-in development — Reqnroll BDD, COM interface wrapping for testability, handler testing, and architectural test conventions.

## When to Activate

- Writing Reqnroll/BDD feature files or step definitions
- Testing CQS handlers that interact with Office documents
- Wrapping COM interop behind testable interfaces
- Setting up test dependencies and mock registration
- Verifying ArchUnitNET naming/coverage conventions

## Reqnroll BDD Workflow

### Feature File Structure

```gherkin
Feature: Insert header into document

  Rule: Header insertion requires an active document

    Background:
      Given a document is open

    Scenario: Insert header with valid title
      Given the document has no existing header
      When I insert a header with title "Quarterly Report"
      Then the document should contain a header
      And the header text should be "Quarterly Report"

    Scenario: Insert header fails without active document
      Given no document is open
      When I attempt to insert a header
      Then the operation fails because no document is active
```

### Key Conventions

| Convention | Pattern |
|-----------|---------|
| Error assertions | `"the operation fails because <semantic reason>"` |
| Background | Shared Givens only, no Whens/Thens |
| Rule blocks | Group related scenarios under business rules |
| Tags | `@smoke`, `@integration`, `@slow` for test filtering |

### Step Definitions with Primary Constructor DI

```csharp
[Binding]
public sealed class HeaderStepDefinitions(
    SharedContext context,
    ICommandHandler<InsertHeaderCommand, Unit> handler)
{
    [Given("a document is open")]
    public void GivenADocumentIsOpen()
    {
        context.Document = DocumentBuilder.Create()
            .WithContent("Sample content")
            .Build();
    }

    [When("I insert a header with title {string}")]
    public async Task WhenIInsertHeader(string title)
    {
        context.Result = await handler.Handle(
            new InsertHeaderCommand(title),
            CancellationToken.None);
    }

    [Then("the document should contain a header")]
    public void ThenDocumentContainsHeader()
    {
        context.Result.IsSuccess.Should().BeTrue();
    }
}
```

### SharedContext for Step-to-Step State

```csharp
/// <summary>
/// Mutable context bag passed between step definitions via DI.
/// Registered as ScenarioContext-scoped (one per scenario).
/// </summary>
public sealed class SharedContext
{
    public Document? Document { get; set; }
    public Result<Unit, Error>? Result { get; set; }
    public Maybe<string> LastError { get; set; }
}
```

### SharedStepDefinitions for Reuse

```csharp
[Binding]
public sealed class SharedStepDefinitions(SharedContext context)
{
    [Given("no document is open")]
    public void GivenNoDocumentIsOpen()
    {
        context.Document = null;
    }

    [Then("the operation fails because no document is active")]
    public void ThenFailsBecauseNoDocument()
    {
        context.Result!.IsFailure.Should().BeTrue();
        context.Result!.Error.Code.Should().Be("Document.NotActive");
    }

    [Then("the operation fails because {string}")]
    public void ThenFailsBecause(string reason)
    {
        context.Result!.IsFailure.Should().BeTrue();
        context.Result!.Error.Message.Should().Contain(reason);
    }
}
```

### BeforeScenario Mock Registration

```csharp
[Binding]
public sealed class TestDependencies(IObjectContainer container)
{
    [BeforeScenario(Order = 0)]
    public void RegisterSharedContext()
    {
        container.RegisterInstanceAs(new SharedContext());
    }

    [BeforeScenario(Order = 1)]
    public void RegisterMocks()
    {
        var documentEditor = Substitute.For<IDocumentEditor>();
        var controlFinder = Substitute.For<IContentControlFinder>();

        container.RegisterInstanceAs(documentEditor);
        container.RegisterInstanceAs(controlFinder);
    }

    [BeforeScenario(Order = 2)]
    public void RegisterHandlers()
    {
        // Resolve mocks already registered, wire into handler
        var editor = container.Resolve<IDocumentEditor>();
        var finder = container.Resolve<IContentControlFinder>();

        container.RegisterInstanceAs<ICommandHandler<InsertHeaderCommand, Unit>>(
            new InsertHeaderHandler(editor, finder));
    }
}
```

**Order convention**: 0 = context, 1 = mocks, 2 = handlers/services

## COM Testability — Interface Wrapping

### The Problem

COM interop types (`Word.Application`, `Word.Document`, `Word.Range`) can't be mocked directly. Wrap them behind application-layer interfaces.

### Interface Hierarchy

```csharp
// Application layer — defines what operations exist
public interface IWordApplication
{
    Maybe<IDocumentEditor> ActiveDocument { get; }
    Result<IDocumentEditor, Error> OpenDocument(string path);
}

public interface IDocumentEditor
{
    Result<Unit, Error> InsertText(DocumentRange range, string text);
    Result<DocumentRange, Error> FindText(string searchText);
    Result<Unit, Error> SetHeader(string text);
}

public interface IContentControlFinder
{
    Result<IReadOnlyList<ContentControlInfo>, Error> FindByTag(string tag);
    Result<IReadOnlyList<ContentControlInfo>, Error> FindByTitle(string title);
}
```

### VSTO Implementation (Interop layer)

```csharp
// Infrastructure/Interop — implements with real COM calls
internal sealed class WordDocumentEditor : IDocumentEditor
{
    private readonly Word.Document _document;

    public WordDocumentEditor(Word.Document document)
    {
        _document = document;
    }

    public Result<Unit, Error> InsertText(DocumentRange range, string text)
    {
        Word.Range comRange = null;
        try
        {
            comRange = _document.Range(range.Start, range.End);
            comRange.Text = text;
            return Unit.Default;
        }
        catch (COMException ex)
        {
            return Error.Failure("Document.InsertFailed", ex.Message);
        }
        finally
        {
            if (comRange != null) Marshal.ReleaseComObject(comRange);
        }
    }
}
```

### Test Usage — No COM Required

```csharp
[Fact]
public async Task Handle_ValidCommand_InsertsHeader()
{
    // Arrange — mock the application-layer interface
    var editor = Substitute.For<IDocumentEditor>();
    editor.SetHeader("Q1 Report").Returns(Result.Success<Unit, Error>(Unit.Default));

    var handler = new InsertHeaderHandler(editor);

    // Act
    var result = await handler.Handle(
        new InsertHeaderCommand("Q1 Report"),
        CancellationToken.None);

    // Assert
    result.IsSuccess.Should().BeTrue();
    editor.Received(1).SetHeader("Q1 Report");
}
```

## Handler Test Pattern

### TestDependencies Registration

```csharp
public static class TestDependencies
{
    public static (THandler Handler, MockSet Mocks) Create<THandler>()
        where THandler : class
    {
        var mocks = new MockSet
        {
            DocumentEditor = Substitute.For<IDocumentEditor>(),
            ControlFinder = Substitute.For<IContentControlFinder>(),
            EventDispatcher = Substitute.For<IDomainEventDispatcher>()
        };

        var handler = Activator.CreateInstance(
            typeof(THandler),
            mocks.DocumentEditor,
            mocks.ControlFinder,
            mocks.EventDispatcher) as THandler;

        return (handler!, mocks);
    }
}

public sealed class MockSet
{
    public IDocumentEditor DocumentEditor { get; init; } = null!;
    public IContentControlFinder ControlFinder { get; init; } = null!;
    public IDomainEventDispatcher EventDispatcher { get; init; } = null!;
}
```

### Testing Result Outcomes

```csharp
[Fact]
public async Task Handle_NoActiveDocument_ReturnsFailure()
{
    var (handler, mocks) = TestDependencies.Create<InsertHeaderHandler>();

    mocks.DocumentEditor
        .SetHeader(Arg.Any<string>())
        .Returns(DomainErrors.Document.NotActive);

    var result = await handler.Handle(
        new InsertHeaderCommand("Title"),
        CancellationToken.None);

    result.IsFailure.Should().BeTrue();
    result.Error.Code.Should().Be("Document.NotActive");
}
```

### Verifying Domain Event Dispatch

```csharp
[Fact]
public async Task Handle_Success_DispatchesHeaderInsertedEvent()
{
    var (handler, mocks) = TestDependencies.Create<InsertHeaderHandler>();

    mocks.DocumentEditor
        .SetHeader("Title")
        .Returns(Result.Success<Unit, Error>(Unit.Default));

    await handler.Handle(new InsertHeaderCommand("Title"), CancellationToken.None);

    await mocks.EventDispatcher.Received(1)
        .DispatchAndClear(Arg.Is<AggregateRoot>(
            a => a.DomainEvents.Any(e => e is HeaderInsertedEvent)));
}
```

## ArchUnitNET Conventions

### Every Handler Must Have a BDD Feature

```csharp
[Fact]
public void AllHandlers_ShouldHaveMatchingFeatureFile()
{
    var handlerTypes = Types.InAssembly(typeof(InsertHeaderHandler).Assembly)
        .That()
        .ImplementInterface(typeof(ICommandHandler<,>))
        .Or()
        .ImplementInterface(typeof(IQueryHandler<,>))
        .GetTypes();

    var featureFiles = Directory.GetFiles(
        TestContext.SolutionDir, "*.feature", SearchOption.AllDirectories)
        .Select(Path.GetFileNameWithoutExtension)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    foreach (var handler in handlerTypes)
    {
        var expectedFeature = handler.Name.Replace("Handler", "");
        featureFiles.Should().Contain(
            f => f.Contains(expectedFeature, StringComparison.OrdinalIgnoreCase),
            $"Handler {handler.Name} must have a matching .feature file");
    }
}
```

### Naming Conventions

```csharp
[Fact]
public void Commands_ShouldEndWithCommand()
{
    Types.InAssembly(applicationAssembly)
        .That().ImplementInterface(typeof(ICommand<>))
        .Should().HaveNameEndingWith("Command")
        .Check(Architecture);
}

[Fact]
public void Queries_ShouldEndWithQuery()
{
    Types.InAssembly(applicationAssembly)
        .That().ImplementInterface(typeof(IQuery<>))
        .Should().HaveNameEndingWith("Query")
        .Check(Architecture);
}
```

## Feature File Naming Convention

| Handler | Feature File |
|---------|-------------|
| `InsertHeaderHandler` | `InsertHeader.feature` |
| `FindContentControlsHandler` | `FindContentControls.feature` |
| `UpdateDocumentPropertiesHandler` | `UpdateDocumentProperties.feature` |

Strip `Handler` suffix → use as feature file name.

## Integration with Existing Skills

- **csharp-testing**: Base xUnit v3 + NSubstitute patterns (this skill extends, not replaces)
- **csharp-patterns**: Result/Maybe/ValueObject usage in test assertions
- **vsto-reviewer**: COM safety patterns that tests should verify
- **vsto-architecture-enforcer**: Architecture rules that ArchUnitNET tests encode
