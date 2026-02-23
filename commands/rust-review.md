---
description: Comprehensive Rust code review for error handling, type design, async safety, performance, and security. Invokes the rust-reviewer agent.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Task
---

# Rust Code Review

This command invokes the **rust-reviewer** agent for comprehensive Rust-specific code review.

## What This Command Does

1. **Identify Rust Changes**: Find modified `.rs` and `Cargo.toml` files via `git diff`
2. **Run Static Analysis**: Execute `cargo clippy`, `cargo fmt --check`
3. **Security Scan**: Run `cargo deny check`, check for injection, hardcoded secrets
4. **Type Design Review**: Analyze ownership patterns, trait usage, public API surface
5. **Async Safety Check**: Verify `Send` futures, cooperative yielding, cancellation safety
6. **Generate Report**: Categorize issues by severity

## When to Use

Use `/rust-review` when:
- After writing or modifying Rust code
- Before committing Rust changes
- Reviewing pull requests with Rust code
- Onboarding to a new Rust codebase

## Review Categories

### CRITICAL (Must Fix)
- `.unwrap()` in non-test production code
- SQL/command injection vulnerabilities
- Hardcoded credentials
- `panic!()` for recoverable errors
- Missing error context on `?` propagation

### HIGH (Should Fix)
- Primitive obsession (raw String/u64 for domain concepts)
- `Arc`/`Rc` leaked in public APIs
- Non-Send futures (MutexGuard across `.await`)
- Unnecessary clones, String where &str suffices
- Missing Debug/Display on public types

### MEDIUM (Consider)
- Missing doc comments on public items
- Weasel names (Manager, Service, Factory)
- Magic values without named constants
- Clippy warnings, unused dependencies
- `#[allow]` instead of `#[expect]`

## Automated Checks Run

```bash
# Formatting
cargo fmt --check

# Lints
cargo clippy -- -D warnings

# Security (advisories, licenses, bans, sources)
cargo deny check

# Tests
cargo test

# Unused dependencies (if installed)
cargo udeps
```

## Example Usage

```text
User: /rust-review

Agent:
# Rust Code Review Report

## Files Reviewed
- src/handler/api.rs (modified)
- src/service/auth.rs (modified)

## Static Analysis Results
✓ cargo fmt: No issues
⚠ cargo clippy: 1 warning

## Issues Found

[CRITICAL] Unwrap in Production Code
File: src/service/auth.rs:32
Issue: .unwrap() on Result in non-test code
```rust
let token = decode_jwt(raw).unwrap(); // Will panic on invalid JWT
```
Fix: Use ? with context
```rust
let token = decode_jwt(raw)
    .context("failed to decode JWT token")?;
```

[HIGH] Primitive Obsession
File: src/handler/api.rs:15
Issue: Using raw String for user ID
```rust
fn get_user(id: String) -> Result<User> { ... }
```
Fix: Use a strong type
```rust
fn get_user(id: UserId) -> Result<User> { ... }
```

## Summary
- CRITICAL: 1
- HIGH: 1
- MEDIUM: 0

Recommendation: ❌ Block merge until CRITICAL issue is fixed
```

## Approval Criteria

| Status | Condition |
|--------|-----------|
| ✅ Approve | No CRITICAL or HIGH issues |
| ⚠️ Warning | Only MEDIUM issues (merge with caution) |
| ❌ Block | CRITICAL or HIGH issues found |

## Integration with Other Commands

- Use `/rust-test` first to ensure tests pass
- Use `/rust-build` if build errors occur
- Use `/rust-review` before committing
- Use `/code-review` for non-Rust specific concerns

## Related

- Agent: `agents/rust-reviewer.md`
- Skills: `skills/rust-patterns/`, `skills/rust-testing/`
