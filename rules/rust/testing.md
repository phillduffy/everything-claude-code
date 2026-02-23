---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
  - "**/Cargo.lock"
---
# Rust Testing

> This file extends [common/testing.md](../common/testing.md) with Rust specific content.

## Framework

Use `cargo test` with table-driven test style and `#[cfg(test)]` modules.

## Async Tests

Use `#[tokio::test]` for async test functions.

## Coverage

```bash
# Preferred
cargo llvm-cov --html

# Alternative
cargo tarpaulin --out Html
```

## TDD Workflow

RED-GREEN-REFACTOR cycle required. Write `#[test]` functions first, implement after.

## Reference

See skill: `rust-testing` for detailed Rust testing patterns, mocking, and benchmarks.
