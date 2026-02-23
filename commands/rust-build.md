---
description: Fix Rust build errors, clippy warnings, and borrow checker issues incrementally. Invokes the rust-build-resolver agent for minimal, surgical fixes.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Rust Build and Fix

This command invokes the **rust-build-resolver** agent to incrementally fix Rust build errors with minimal changes.

## What This Command Does

1. **Run Diagnostics**: Execute `cargo check`, `cargo build`, `cargo clippy`
2. **Parse Errors**: Group by file and sort by severity
3. **Fix Incrementally**: One error at a time
4. **Verify Each Fix**: Re-run `cargo check` after each change
5. **Report Summary**: Show what was fixed and what remains

## When to Use

Use `/rust-build` when:
- `cargo check` or `cargo build` fails with errors
- `cargo clippy` reports warnings
- Borrow checker or lifetime errors are confusing
- After pulling changes that break the build
- Cargo dependency resolution fails

## Diagnostic Commands Run

```bash
# Primary build check
cargo check

# Full build
cargo build

# Lint check
cargo clippy -- -D warnings

# Format check
cargo fmt --check

# Dependency issues
cargo tree -d
cargo update
```

## Example Session

```text
User: /rust-build

Agent:
# Rust Build Resolution

## Initial Diagnostics

```bash
$ cargo check
error[E0382]: use of moved value: `conn`
  --> src/db.rs:25:15
error[E0277]: the trait bound `MyStruct: Send` is not satisfied
  --> src/handler.rs:42:9
error[E0106]: missing lifetime specifier
  --> src/parser.rs:18:35
```

Errors found: 3

## Fix 1: Use of Moved Value

File: src/db.rs:25
Error: E0382 — use of moved value `conn`
Cause: `conn` moved into first query, reused in second

```rust
// Changed: borrow instead of move
let result1 = query(&conn, "SELECT ...").await?;
let result2 = query(&conn, "SELECT ...").await?;
```

```bash
$ cargo check
# 2 errors remaining
```

## Fix 2: Non-Send Future

File: src/handler.rs:42
Error: E0277 — `MyStruct: Send` not satisfied
Cause: `Rc<T>` held across `.await` point

```rust
// Changed Rc to Arc for Send compatibility
let shared = Arc::new(data);
async_operation().await;
```

```bash
$ cargo check
# 1 error remaining
```

## Fix 3: Missing Lifetime

File: src/parser.rs:18
Error: E0106 — missing lifetime specifier

```rust
// Added explicit lifetime
fn parse<'a>(input: &'a str) -> Token<'a> {
    // ...
}
```

```bash
$ cargo check
# Build successful!
```

## Final Verification

```bash
$ cargo clippy -- -D warnings
# No warnings

$ cargo test
ok  crate::db       0.015s
ok  crate::handler  0.023s
ok  crate::parser   0.008s
```

## Summary

| Metric | Count |
|--------|-------|
| Build errors fixed | 3 |
| Clippy warnings fixed | 0 |
| Files modified | 3 |
| Remaining issues | 0 |

Build Status: ✅ SUCCESS
```

## Common Errors Fixed

| Error | Typical Fix |
|-------|-------------|
| E0382 — moved value | Borrow, clone, or restructure ownership |
| E0505 — moved out of borrow | Restructure borrow scopes |
| E0502 — mutable borrow conflict | Separate borrow scopes, interior mutability |
| E0106 — missing lifetime | Add explicit lifetime annotation |
| E0277 — trait not satisfied | Add derive, impl, or change type |
| E0308 — type mismatch | Conversion, `.into()`, or fix signature |
| E0432 — unresolved import | Fix path or add dependency |
| E0046 — missing trait items | Implement required methods |

## Fix Strategy

1. **Build errors first** — Code must compile
2. **Borrow checker second** — Fix ownership/lifetime issues
3. **Clippy warnings third** — Lint compliance
4. **One fix at a time** — Verify each change
5. **Minimal changes** — Don't refactor, just fix

## Stop Conditions

The agent will stop and report if:
- Same error persists after 3 attempts
- Fix introduces more errors
- Requires architectural changes
- Missing external dependencies

## Related Commands

- `/rust-test` — Run tests after build succeeds
- `/rust-review` — Review code quality
- `/verify` — Full verification loop

## Related

- Agent: `agents/rust-build-resolver.md`
- Skill: `skills/rust-patterns/`
