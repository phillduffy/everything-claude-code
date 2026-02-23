---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
  - "**/Cargo.lock"
---
# Rust Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Rust specific content.

## Error Handling

- `thiserror` for libraries, `anyhow` for applications
- Always wrap errors with context via `.context()` or `with_context()`
- Use `?` operator for propagation, `bail!()` for early returns
- Programming bugs are panics, not errors

## Type Design

- Strong types over primitives (newtype pattern)
- Builder pattern for types with 4+ initialization parameters
- Hide `Arc`/`Rc`/`Box` from public APIs

## Async

- Tokio-first, ensure all futures are `Send`
- Yield cooperatively in long CPU-bound async work

## Reference

See skill: `rust-patterns` for comprehensive Rust patterns including async, performance, and crate organization.
