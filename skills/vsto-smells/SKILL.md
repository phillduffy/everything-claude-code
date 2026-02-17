---
name: vsto-smells
description: VSTO and Office add-in specific code smells — COM lifecycle violations, lifecycle boundary breaches, and Office object model anti-patterns. Extends csharp-smells with Office-specific detection. Use when reviewing VSTO code quality, detecting Office anti-patterns, or scanning for COM safety violations beyond what csharp-smells covers.
---

# VSTO Code Smell Detection

Office add-in specific code smells that go beyond generic C# smells. These target COM lifecycle violations, VSTO layer boundary breaches, and Office object model anti-patterns.

## When to Activate

- Reviewing VSTO add-in code for quality issues
- Scanning for COM-specific anti-patterns
- Checking lifecycle boundary violations
- Detecting Office object model misuse
- Pre-commit review of VSTO changes

## Severity Classification

| Severity | Smells | Action |
|----------|--------|--------|
| **CRITICAL** | Business logic in ThisAddIn, Caching ActiveDocument, foreach/LINQ on COM, Double-dot COM, async void in COM callback, COM ref in event field | Block merge |
| **HIGH** | Selection instead of Range, Missing ScreenUpdating, Domain logic in Ribbon/EventHandler, Missing RCW release in finally | Block merge |
| **MEDIUM** | Missing ConfigureAwait(true), Excessive COM round-trips, Large interop method, Missing COM null check | Warn |

## CRITICAL Smells

### 1. Business Logic in ThisAddIn_Startup

```csharp
// SMELL: ThisAddIn doing work beyond DI + event subscription
private void ThisAddIn_Startup(object sender, EventArgs e)
{
    var doc = Application.ActiveDocument;       // ← SMELL: COM access
    if (doc.CustomProperties["License"] != null) // ← SMELL: Business logic
        EnablePremiumFeatures();                  // ← SMELL: Conditional behavior
}
```

**Fix**: Move to a command handler dispatched after startup.

**Detection**:
```bash
rg "ThisAddIn_Startup" --type cs -A 20 | rg "(ActiveDocument|\.Documents|if |switch |for |while )"
```

### 2. Caching ActiveDocument

```csharp
// SMELL: ActiveDocument can change at any time (user switches docs)
private Word.Document _cachedDoc;

public void Initialize()
{
    _cachedDoc = Application.ActiveDocument; // ← SMELL: Stale reference
}

public void DoWork()
{
    _cachedDoc.Content.Text = "Hello"; // May crash — doc may be closed
}
```

**Fix**: Access `Application.ActiveDocument` fresh each time, or use `Maybe<IDocumentEditor>`.

**Detection**:
```bash
rg "private.*Word\.Document\s+\w+" --type cs
rg "=\s*Application\.ActiveDocument" --type cs
```

### 3. foreach/LINQ on COM Collection

```csharp
// SMELL: Can't release individual COM objects from foreach
foreach (Word.Paragraph p in document.Paragraphs) // ← SMELL
{
    var text = p.Range.Text; // ← SMELL: double-dot too
}

// SMELL: LINQ hides COM lifecycle entirely
var titles = document.ContentControls
    .Cast<Word.ContentControl>()  // ← SMELL: LINQ on COM
    .Where(cc => cc.Tag == "title")
    .Select(cc => cc.Range.Text)
    .ToList();
```

**Fix**: Use indexed `for` loop with explicit `Marshal.ReleaseComObject` in finally.

**Detection**:
```bash
rg "foreach.*Word\." --type cs
rg "\.(Cast|Select|Where|OrderBy|GroupBy|Any|All|First).*Word\." --type cs
```

### 4. Double-Dot COM Access

```csharp
// SMELL: Intermediate COM objects leak
var text = document.Paragraphs[1].Range.Text;     // ← 2 leaked objects
var name = Application.ActiveDocument.Name;         // ← 1 leaked object
section.Headers[WdHeaderFooterIndex.wdHeaderFooterPrimary].Range.Text = "Header"; // ← 3 leaked
```

**Fix**: Store each intermediate in a local, release in reverse order in finally block.

**Detection**:
```bash
rg "\.\w+\.\w+\.\w+" --type cs --glob "**/Interop/**"
rg "Application\.\w+\.\w+" --type cs
```

### 5. async void in COM Callback

```csharp
// SMELL: Unobservable exception + potential STA violation
public async void OnDocumentOpen(Word.Document doc) // ← SMELL: async void
{
    await ProcessDocumentAsync(doc); // Exception goes nowhere
}
```

**Fix**: Use `async Task` with fire-and-forget wrapper that logs exceptions, or synchronous dispatch.

**Detection**:
```bash
rg "async void" --type cs --glob "**/*EventHandler*" --glob "**/*Ribbon*" --glob "**/*ThisAddIn*"
```

### 6. COM Reference Stored in Event Handler Field

```csharp
// SMELL: COM object from event may become invalid
private Word.Document _lastOpenedDoc; // ← SMELL: stored COM ref

public void OnDocumentOpen(Word.Document doc)
{
    _lastOpenedDoc = doc; // ← SMELL: ref may dangle after doc closes
}
```

**Fix**: Extract primitive data (path, name) from the COM object, don't store the reference.

**Detection**:
```bash
rg "private.*Word\.(Document|Range|Selection|Paragraph|ContentControl)" --type cs --glob "**/*EventHandler*"
```

## HIGH Smells

### 7. Selection Instead of Range

```csharp
// SMELL: Selection causes screen flicker, is slower, and only works with visible doc
Application.Selection.TypeText("Hello");            // ← SMELL
Application.Selection.MoveRight(WdUnits.wdCharacter, 5); // ← SMELL
```

**Fix**: Use `Word.Range` for all programmatic text manipulation.

**Detection**:
```bash
rg "Application\.Selection\." --type cs
rg "\.Selection\.(Type|Move|Extend|Home|End)" --type cs
```

### 8. Missing ScreenUpdating Toggle

```csharp
// SMELL: Bulk operation without disabling screen updates
for (int i = 1; i <= 100; i++)
{
    document.Paragraphs[i].Range.Bold = 1; // ← SMELL: 100 screen redraws
}
```

**Fix**: Wrap in `Application.ScreenUpdating = false` / `true` with try/finally.

**Detection**: Look for loops that access COM properties repeatedly without `ScreenUpdating` guard.
```bash
rg "for.*\+\+|while\s*\(" --type cs --glob "**/Interop/**" -A 5 | rg "\.(Range|Text|Bold|Italic|Font)"
```

### 9. Domain Logic in Ribbon/EventHandler

```csharp
// SMELL: Ribbon deciding business rules
public void OnExportClick(IRibbonControl control)
{
    var doc = Globals.ThisAddIn.Application.ActiveDocument;
    if (doc.CustomProperties["Approved"] == "true")  // ← SMELL: business logic
    {
        ExportToPdf(doc);                             // ← SMELL: direct operation
    }
    else
    {
        ShowError("Document must be approved first"); // ← SMELL: UI logic
    }
}
```

**Fix**: Dispatch `ExportCommand` — let handler + decorators handle guards and logic.

**Detection**:
```bash
rg "if |switch |for |while " --type cs --glob "**/*Ribbon*" --glob "**/*EventHandler*"
```

### 10. Missing RCW Release in Finally

```csharp
// SMELL: COM object leaks on exception
Word.Range range = document.Content;
range.Text = "Hello";
Marshal.ReleaseComObject(range); // ← SMELL: Not in finally — skipped on exception
```

**Fix**: Always release in `finally` block.

**Detection**:
```bash
rg "Marshal\.ReleaseComObject" --type cs -B 5 | rg -v "finally"
```

## MEDIUM Smells

### 11. Missing ConfigureAwait(true) for COM Access

```csharp
// SMELL: Continuation may resume on thread pool, not STA
var data = await ComputeAsync();
document.Content.Text = data; // ← SMELL: May be on wrong thread
```

**Fix**: Use `ConfigureAwait(true)` before COM access to stay on STA thread.

### 12. Excessive COM Round-Trips

```csharp
// SMELL: Each property access is a COM round-trip
var name = document.Name;           // Round-trip 1
var path = document.Path;           // Round-trip 2
var fullName = document.FullName;   // Round-trip 3
var readOnly = document.ReadOnly;   // Round-trip 4
```

**Fix**: Batch related reads or use a single extraction method.

### 13. Large Interop Method (>30 lines)

Interop methods that grow beyond 30 lines usually mean domain logic has leaked into the interop layer.

**Fix**: Extract domain logic to handler, keep interop method as thin translation layer.

### 14. Missing COM Null Check

```csharp
// SMELL: ActiveDocument may be null if no documents are open
var doc = Application.ActiveDocument; // ← SMELL: May throw COMException
doc.Content.Text = "Hello";
```

**Fix**: Check for null or use `Maybe<IDocumentEditor>` pattern.

## Detection Workflow

```bash
# 1. Find all VSTO-related files
fd "\.cs$" --type f | rg "(Interop|Ribbon|EventHandler|ThisAddIn)"

# 2. Run critical smell checks
rg "foreach.*Word\." --type cs                          # foreach on COM
rg "\.\w+\.\w+\.\w+" --type cs --glob "**/Interop/**"  # Double-dot
rg "async void" --type cs                                # async void
rg "private.*Word\.(Document|Range)" --type cs           # Stored COM refs
rg "Application\.Selection\." --type cs                  # Selection usage
rg "ThisAddIn_Startup" --type cs -A 20                   # ThisAddIn logic

# 3. Check lifecycle boundaries
rg "if |switch " --type cs --glob "**/*Ribbon*"          # Logic in Ribbon
rg "ActiveDocument" --type cs --glob "**/*ThisAddIn*"    # COM in ThisAddIn
```

## Integration with Existing Skills

- **csharp-smells**: Generic C# smells (this skill adds VSTO-specific ones)
- **vsto-reviewer**: COM safety patterns these smells violate
- **vsto-architecture-enforcer**: Lifecycle boundaries these smells breach
- **office-document-patterns**: Correct patterns to replace these smells
