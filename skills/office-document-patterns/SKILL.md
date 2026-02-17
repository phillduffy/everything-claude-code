---
name: office-document-patterns
description: Office document manipulation patterns — Strategy pattern for search/find/content controls, COM-free domain model with value objects, Document aggregate root, and application-layer abstractions. Use when creating new document strategies, working with document ranges, content controls, or understanding how the Application layer defines operations that VSTO implements.
---

# Office Document Manipulation Patterns

Patterns for building a testable, COM-free domain model for Office document manipulation. Covers strategy interfaces, value objects, the document aggregate root, and application-layer abstractions.

## When to Activate

- Creating new search, find, or content control strategies
- Working with document ranges, selections, or delimiter pairs
- Building document manipulation features
- Understanding Application-layer abstractions vs VSTO implementations
- Extending the document aggregate root

## Strategy Pattern — Extension Mechanism

Strategies are sealed records implementing typed interfaces. New behaviors are added by creating new strategy records, not modifying existing code.

### ISearchDirectionStrategy

Controls search direction through a document.

```csharp
public interface ISearchDirectionStrategy
{
    DocumentRange GetSearchRange(DocumentRange fullRange);
    bool IsForward { get; }
}

// Implementations as sealed records
public sealed record ForwardSearch : ISearchDirectionStrategy
{
    public DocumentRange GetSearchRange(DocumentRange fullRange) => fullRange;
    public bool IsForward => true;
}

public sealed record BackwardSearch : ISearchDirectionStrategy
{
    public DocumentRange GetSearchRange(DocumentRange fullRange) =>
        fullRange with { Start = fullRange.End, End = fullRange.Start };
    public bool IsForward => false;
}

public sealed record FromSelectionForward(Selection Current) : ISearchDirectionStrategy
{
    public DocumentRange GetSearchRange(DocumentRange fullRange) =>
        fullRange with { Start = Current.End };
    public bool IsForward => true;
}
```

### IFindStrategy&lt;T&gt;

Defines what to find and how to extract results from a match.

```csharp
public interface IFindStrategy<out T>
{
    string SearchText { get; }
    FindOptions Options { get; }
    T ExtractResult(DocumentRange matchRange);
}

// Find delimiter pairs (e.g., matching brackets, XML tags)
public sealed record FindDelimiterPair(
    string OpenDelimiter,
    string CloseDelimiter) : IFindStrategy<DelimiterPair>
{
    public string SearchText => OpenDelimiter;
    public FindOptions Options => FindOptions.Literal;

    public DelimiterPair ExtractResult(DocumentRange matchRange) =>
        new(OpenDelimiter, CloseDelimiter, matchRange);
}

// Find text with pattern matching
public sealed record FindByPattern(
    string Pattern,
    bool UseWildcards = true) : IFindStrategy<DocumentRange>
{
    public string SearchText => Pattern;
    public FindOptions Options => UseWildcards ? FindOptions.Wildcard : FindOptions.Literal;

    public DocumentRange ExtractResult(DocumentRange matchRange) => matchRange;
}
```

### IContentControlStrategy

Operations on content controls by type, tag, or title.

```csharp
public interface IContentControlStrategy
{
    Result<IReadOnlyList<ContentControlInfo>, Error> Execute(
        IContentControlFinder finder);
}

public sealed record FindByTag(string Tag) : IContentControlStrategy
{
    public Result<IReadOnlyList<ContentControlInfo>, Error> Execute(
        IContentControlFinder finder) =>
        finder.FindByTag(Tag);
}

public sealed record FindByTitle(string Title) : IContentControlStrategy
{
    public Result<IReadOnlyList<ContentControlInfo>, Error> Execute(
        IContentControlFinder finder) =>
        finder.FindByTitle(Title);
}

public sealed record FindByType(ContentControlType Type) : IContentControlStrategy
{
    public Result<IReadOnlyList<ContentControlInfo>, Error> Execute(
        IContentControlFinder finder) =>
        finder.FindByType(Type);
}
```

### Adding a New Strategy

1. Create a new sealed record implementing the strategy interface
2. No modifications to existing strategies or consumers needed
3. The handler/service accepts the interface, strategy is passed from the command

```csharp
// Command carries the strategy
public sealed record FindInDocumentCommand(
    IFindStrategy<DocumentRange> Strategy,
    ISearchDirectionStrategy Direction) : ICommand<IReadOnlyList<DocumentRange>>;

// Handler uses strategy polymorphically
public sealed class FindInDocumentHandler(IDocumentEditor editor)
    : ICommandHandler<FindInDocumentCommand, IReadOnlyList<DocumentRange>>
{
    public Result<IReadOnlyList<DocumentRange>, Error> Handle(
        FindInDocumentCommand command, CancellationToken ct)
    {
        var searchRange = command.Direction.GetSearchRange(editor.FullRange);
        return editor.FindAll(command.Strategy, searchRange);
    }
}
```

## COM-Free Domain Model

The domain layer contains **zero** COM references. All document concepts are represented as value objects.

### DocumentRange

```csharp
public sealed record DocumentRange(int Start, int End)
{
    public int Length => End - Start;
    public bool IsEmpty => Start == End;
    public bool Contains(DocumentRange other) =>
        Start <= other.Start && End >= other.End;
    public bool Overlaps(DocumentRange other) =>
        Start < other.End && End > other.Start;

    public static DocumentRange Empty => new(0, 0);
}
```

### DelimiterPair

```csharp
public sealed record DelimiterPair(
    string OpenDelimiter,
    string CloseDelimiter,
    DocumentRange Range)
{
    public DocumentRange InnerRange => new(
        Range.Start + OpenDelimiter.Length,
        Range.End - CloseDelimiter.Length);
}
```

### Selection

```csharp
public sealed record Selection(DocumentRange Range, string Text)
{
    public bool IsCollapsed => Range.IsEmpty;
    public static Selection None => new(DocumentRange.Empty, string.Empty);
}
```

### ContentControlInfo

```csharp
public sealed record ContentControlInfo(
    string Id,
    string Tag,
    string Title,
    ContentControlType Type,
    DocumentRange Range,
    bool IsLocked);
```

### Translation Rule

The Interop layer translates between COM types and domain value objects:

```
COM Word.Range  ↔  DocumentRange (Start, End)
COM Word.Selection  ↔  Selection (Range, Text)
COM Word.ContentControl  ↔  ContentControlInfo (Id, Tag, Title, ...)
```

Domain code never touches `Word.*` types. Interop code never contains business logic.

## Document Aggregate Root

### DocumentBuilder

```csharp
public sealed class Document : AggregateRoot
{
    public string Path { get; private init; } = string.Empty;
    public CustomProperties Properties { get; private init; } = new();
    public DocumentVariables Variables { get; private init; } = new();

    private Document() { }

    public Result<Unit, Error> SetProperty(string key, string value)
    {
        if (string.IsNullOrWhiteSpace(key))
            return DomainErrors.Document.InvalidPropertyKey;

        Properties.Set(key, value);
        RaiseDomainEvent(new DocumentPropertyChangedEvent(Path, key, value));
        return Unit.Default;
    }

    public Result<Unit, Error> SetVariable(string name, string value)
    {
        Variables.Set(name, value);
        RaiseDomainEvent(new DocumentVariableChangedEvent(Path, name, value));
        return Unit.Default;
    }
}

public static class DocumentBuilder
{
    public static Builder Create() => new();

    public sealed class Builder
    {
        private string _path = string.Empty;
        private readonly Dictionary<string, string> _properties = new();
        private readonly Dictionary<string, string> _variables = new();

        public Builder WithPath(string path) { _path = path; return this; }
        public Builder WithProperty(string key, string value) { _properties[key] = value; return this; }
        public Builder WithVariable(string name, string value) { _variables[name] = value; return this; }
        public Builder WithContent(string content) { /* test helper */ return this; }

        public Document Build()
        {
            var doc = new Document { Path = _path };
            foreach (var (key, value) in _properties)
                doc.Properties.Set(key, value);
            foreach (var (name, value) in _variables)
                doc.Variables.Set(name, value);
            return doc;
        }
    }
}
```

### CustomProperties / DocumentVariables

```csharp
public sealed class CustomProperties
{
    private readonly Dictionary<string, string> _items = new(StringComparer.OrdinalIgnoreCase);

    public Maybe<string> Get(string key) =>
        _items.TryGetValue(key, out var value) ? value : Maybe<string>.None;

    public void Set(string key, string value) => _items[key] = value;
    public bool Has(string key) => _items.ContainsKey(key);
    public IReadOnlyDictionary<string, string> All => _items;
}
```

## Application-Layer Abstractions

The Application layer **defines** what operations exist. The VSTO/Interop layer **implements** them.

### IDocumentEditor

```csharp
public interface IDocumentEditor
{
    Result<Unit, Error> InsertText(DocumentRange range, string text);
    Result<Unit, Error> ReplaceText(DocumentRange range, string newText);
    Result<Unit, Error> DeleteText(DocumentRange range);
    Result<DocumentRange, Error> FindText(string text, FindOptions options);
    Result<IReadOnlyList<DocumentRange>, Error> FindAll<T>(
        IFindStrategy<T> strategy, DocumentRange searchRange);
    Result<Unit, Error> SetHeader(string text);
    Result<Unit, Error> SetFooter(string text);
    DocumentRange FullRange { get; }
}
```

### IDocumentContentControl

```csharp
public interface IDocumentContentControl
{
    Result<ContentControlInfo, Error> Insert(
        DocumentRange range, ContentControlType type, string tag, string title);
    Result<Unit, Error> Remove(string id);
    Result<Unit, Error> SetValue(string id, string value);
    Result<Unit, Error> Lock(string id);
}
```

### IContentControlFinder

```csharp
public interface IContentControlFinder
{
    Result<IReadOnlyList<ContentControlInfo>, Error> FindByTag(string tag);
    Result<IReadOnlyList<ContentControlInfo>, Error> FindByTitle(string title);
    Result<IReadOnlyList<ContentControlInfo>, Error> FindByType(ContentControlType type);
    Result<Maybe<ContentControlInfo>, Error> FindById(string id);
}
```

### Layer Rule

```
Domain:      Value objects (DocumentRange, Selection, ContentControlInfo)
Application: Interfaces (IDocumentEditor, IContentControlFinder) + Strategies
Interop:     Implementations (WordDocumentEditor, WordContentControlFinder)
```

Application defines the **contract**. Interop handles the **COM mess**. Domain stays **pure**.

## Integration with Existing Skills

- **csharp-patterns**: Result/Maybe/ValueObject base patterns used throughout
- **vsto-testing**: How to test strategies and handlers without COM
- **vsto-reviewer**: COM safety rules the Interop layer must follow
- **decorator-chain-patterns**: How handlers using these patterns get decorated
