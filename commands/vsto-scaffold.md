---
description: Scaffold a new VSTO command/query handler — generates Command.cs, Handler.cs, .feature, StepDefinitions.cs, plus DI and test dependency registration.
---

# VSTO Scaffold

Generates the full 4-file set for a new CQS handler in a VSTO add-in project, following established conventions.

## What This Command Does

1. **Gather input**: Feature name, command vs query, response type
2. **Generate 4 files**:
   - `{Feature}Command.cs` or `{Feature}Query.cs` — the request type
   - `{Feature}Handler.cs` — the handler with `[RequireEntitlement]`
   - `{Feature}.feature` — Reqnroll BDD feature file with scenarios
   - `{Feature}StepDefinitions.cs` — step definitions with primary constructor DI
3. **Update DI registration**: Add handler to service collection
4. **Update test dependencies**: Add mock registration to `TestDependencies.cs`

## When to Use

Use `/vsto-scaffold` when:
- Starting a new feature that needs a command or query handler
- Ensuring all convention files are created together
- Avoiding missing `.feature` file violations from ArchUnitNET

## Usage

```text
/vsto-scaffold InsertHeader command Unit
/vsto-scaffold GetDocumentProperties query DocumentPropertiesResponse
```

Arguments: `{FeatureName} {command|query} {ResponseType}`

## Generated Files

### Example: `/vsto-scaffold InsertHeader command Unit`

#### 1. Command — `Features/Header/InsertHeaderCommand.cs`

```csharp
namespace Core.Application.Features.Header;

public sealed record InsertHeaderCommand(
    string HeaderText) : ICommand<Unit>;
```

#### 2. Handler — `Features/Header/InsertHeaderHandler.cs`

```csharp
namespace Core.Application.Features.Header;

[RequireEntitlement("InsertHeader")]
[DocumentRequired]
public sealed class InsertHeaderHandler(
    IDocumentEditor documentEditor)
    : ICommandHandler<InsertHeaderCommand, Unit>
{
    public async Task<Result<Unit, Error>> Handle(
        InsertHeaderCommand command, CancellationToken ct)
    {
        var result = documentEditor.SetHeader(command.HeaderText);

        return result;
    }
}
```

#### 3. Feature — `Features/Header/InsertHeader.feature`

```gherkin
Feature: Insert header

  Rule: Header insertion requires an active document with valid input

    Background:
      Given a document is open

    Scenario: Successfully insert header
      When I insert a header with text "Quarterly Report"
      Then the operation should succeed
      And the document header should be "Quarterly Report"

    Scenario: Insert header fails without active document
      Given no document is open
      When I attempt to insert a header
      Then the operation fails because no document is active

    Scenario: Insert header fails with empty text
      When I insert a header with text ""
      Then the operation fails because the header text is empty
```

#### 4. Step Definitions — `Features/Header/InsertHeaderStepDefinitions.cs`

```csharp
namespace Core.Application.Tests.Features.Header;

[Binding]
public sealed class InsertHeaderStepDefinitions(
    SharedContext context,
    ICommandHandler<InsertHeaderCommand, Unit> handler)
{
    [When("I insert a header with text {string}")]
    public async Task WhenInsertHeader(string text)
    {
        context.Result = await handler.Handle(
            new InsertHeaderCommand(text),
            CancellationToken.None);
    }

    [When("I attempt to insert a header")]
    public async Task WhenAttemptInsertHeader()
    {
        context.Result = await handler.Handle(
            new InsertHeaderCommand("Default"),
            CancellationToken.None);
    }

    [Then("the document header should be {string}")]
    public void ThenHeaderShouldBe(string expected)
    {
        context.Result!.IsSuccess.Should().BeTrue();
    }
}
```

### DI Registration Addition

```csharp
// In ServiceCollectionExtensions.cs or similar
services.AddScoped<ICommandHandler<InsertHeaderCommand, Unit>, InsertHeaderHandler>();
```

### Test Dependencies Addition

```csharp
// In TestDependencies [BeforeScenario] handler registration
container.RegisterInstanceAs<ICommandHandler<InsertHeaderCommand, Unit>>(
    new InsertHeaderHandler(
        container.Resolve<IDocumentEditor>()));
```

## File Placement Convention

```
Core.Application/
  Features/
    {FeatureName}/
      {FeatureName}Command.cs    (or {FeatureName}Query.cs)
      {FeatureName}Handler.cs

Core.Application.Tests/
  Features/
    {FeatureName}/
      {FeatureName}.feature
      {FeatureName}StepDefinitions.cs
```

## Checklist After Scaffolding

- [ ] Customize command/query properties beyond the placeholder
- [ ] Implement actual handler logic (scaffold provides structure only)
- [ ] Add specific scenarios to `.feature` file for your use case
- [ ] Register handler in DI container
- [ ] Register handler in test `TestDependencies`
- [ ] Run `dotnet build` to verify compilation
- [ ] Run `dotnet test` to verify BDD scenarios (should fail — RED phase)

## Related

- Skills: `skills/vsto-testing/`, `skills/office-document-patterns/`, `skills/decorator-chain-patterns/`
- Commands: `/vsto-review` (review after implementation), `/csharp-test` (TDD workflow)
- Agents: `agents/vsto-architecture-enforcer.md` (validates conventions)
