---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
  - "**/Cargo.lock"
---
# Rust Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Rust specific content.

## Formatting

- **rustfmt** is mandatory — no style debates
- Run `cargo fmt --check` in CI

## Naming

- `snake_case` for functions, methods, variables, modules
- `CamelCase` for types, traits, enum variants
- `SCREAMING_SNAKE_CASE` for constants and statics
- Getters use field name (`fn port()`, not `fn get_port()`)
- Conversions: `as_` (cheap ref), `to_` (expensive), `into_` (consuming)

## Lint Configuration

- Clippy with pedantic + restriction subset recommended (see `skill: rust-patterns`)
- Use `#[expect(lint, reason = "...")]` over `#[allow]` — warns when lint is no longer triggered

## Reference

See skill: `rust-patterns` for comprehensive Rust idioms and patterns.
