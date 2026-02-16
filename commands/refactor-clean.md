# Refactor Clean

Safely identify and remove dead code with test verification at every step.

## Step 1: Detect Dead Code

Run analysis tools based on project type:

| Language | Tool | What It Finds | Command |
|----------|------|--------------|---------|
| C# | Roslyn | Unused private members, usings, variables | `dotnet build -warnaserror` |
| C# | Grep | Commented-out code, `[Obsolete]`, `#if false` | `rg '^\s*//' --glob '*.cs' -c` |
| C# | csharp-smells | Dispensable smells: Dead Code, Duplicate Code, Lazy Class, Speculative Generality | See `csharp-smells` skill |
| JS/TS | knip | Unused exports, files, dependencies | `npx knip` |
| JS/TS | depcheck | Unused npm dependencies | `npx depcheck` |
| JS/TS | ts-prune | Unused TypeScript exports | `npx ts-prune` |
| Python | vulture | Unused Python code | `vulture src/` |
| Go | deadcode | Unused Go code | `deadcode ./...` |
| Rust | cargo-udeps | Unused Rust dependencies | `cargo +nightly udeps` |

If no tool is available, use Grep to find exports with zero imports:
```
# Find exports, then check if they're imported anywhere
```

## Step 2: Categorize Findings

Sort findings into safety tiers:

| Tier | Examples | Action |
|------|----------|--------|
| **SAFE** | Unused utilities, test helpers, internal functions, unused private members (IDE0051), commented-out code | Delete with confidence |
| **CAUTION** | Components, API routes, `[Obsolete]` members, single-implementation interfaces, Lazy Classes | Verify no dynamic usage or external consumers |
| **DANGER** | Config files, entry points, public API, extension methods, virtual members | Investigate before touching |

## Step 3: Safe Deletion Loop

For each SAFE item:

1. **Run full test suite** — Establish baseline (all green)
2. **Delete the dead code** — Use Edit tool for surgical removal
3. **Re-run test suite** — Verify nothing broke
4. **If tests fail** — Immediately revert with `git checkout -- <file>` and skip this item
5. **If tests pass** — Move to next item

## Step 4: Handle CAUTION Items

Before deleting CAUTION items:
- **JS/TS**: Search for dynamic imports (`import()`, `require()`), string references in configs
- **C#**: Check `[InternalsVisibleTo]`, reflection usage, test mocks (NSubstitute)
- **All**: Check if exported from a public package API, verify no external consumers

## Step 5: Consolidate Duplicates

After removing dead code, look for:
- Near-duplicate functions (>80% similar) — merge into one
- Redundant type definitions — consolidate
- Wrapper functions that add no value — inline them
- Re-exports that serve no purpose — remove indirection

## Step 6: Summary

Report results:

```
Dead Code Cleanup
──────────────────────────────
Deleted:   12 unused functions
           3 unused files
           5 unused dependencies
Skipped:   2 items (tests failed)
Saved:     ~450 lines removed
──────────────────────────────
All tests passing
```

## Rules

- **Never delete without running tests first**
- **One deletion at a time** — Atomic changes make rollback easy
- **Skip if uncertain** — Better to keep dead code than break production
- **Don't refactor while cleaning** — Separate concerns (clean first, refactor later)
