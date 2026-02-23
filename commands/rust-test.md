---
description: Enforce TDD workflow for Rust. Write tests first with table-driven style, then implement. Verify 80%+ coverage with cargo-llvm-cov.
---

# Rust TDD Command

This command enforces test-driven development methodology for Rust code using idiomatic Rust testing patterns.

## What This Command Does

1. **Define Types/Traits**: Scaffold type signatures and trait definitions first
2. **Write Tests**: Create `#[test]` functions with table-driven cases (RED)
3. **Run Tests**: Verify tests fail for the right reason
4. **Implement Code**: Write minimal code to pass (GREEN)
5. **Refactor**: Improve while keeping tests green
6. **Check Coverage**: Ensure 80%+ coverage

## When to Use

Use `/rust-test` when:
- Implementing new Rust functions or types
- Adding test coverage to existing code
- Fixing bugs (write failing test first)
- Building critical business logic
- Learning TDD workflow in Rust

## TDD Cycle

```
RED     → Write failing #[test] functions with table-driven cases
GREEN   → Implement minimal code to pass
REFACTOR → Improve code, tests stay green
REPEAT  → Next test case
```

## Example Session

````
User: /rust-test I need a function to parse duration strings like "5s", "100ms", "2m"

Agent:
# TDD Session: Duration Parser

## Step 1: Define Types

```rust
// src/duration.rs
use thiserror::Error;
use std::time::Duration;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("empty input")]
    Empty,
    #[error("invalid format: {0}")]
    InvalidFormat(String),
    #[error("unknown unit: {0}")]
    UnknownUnit(String),
}

pub fn parse_duration(input: &str) -> Result<Duration, ParseError> {
    todo!()
}
```

## Step 2: Write Table-Driven Tests (RED)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_duration() {
        let cases = vec![
            // Valid durations
            ("1s", Ok(Duration::from_secs(1))),
            ("500ms", Ok(Duration::from_millis(500))),
            ("2m", Ok(Duration::from_secs(120))),
            ("100us", Ok(Duration::from_micros(100))),

            // Invalid inputs
            ("", Err(ParseError::Empty)),
            ("abc", Err(ParseError::InvalidFormat("abc".into()))),
            ("5x", Err(ParseError::UnknownUnit("x".into()))),
        ];

        for (input, expected) in cases {
            let result = parse_duration(input);
            match (&result, &expected) {
                (Ok(got), Ok(want)) => {
                    assert_eq!(got, want, "parse_duration({input:?})");
                }
                (Err(_), Err(_)) => {} // Both errors — pass
                _ => panic!(
                    "parse_duration({input:?}) = {result:?}, expected {expected:?}"
                ),
            }
        }
    }
}
```

## Step 3: Run Tests - Verify FAIL

```bash
$ cargo test
thread panicked at 'not yet implemented'
test duration::tests::test_parse_duration ... FAILED
```

✓ Tests fail as expected (todo! panic).

## Step 4: Implement Minimal Code (GREEN)

```rust
pub fn parse_duration(input: &str) -> Result<Duration, ParseError> {
    if input.is_empty() {
        return Err(ParseError::Empty);
    }

    let (num_str, unit) = input
        .find(|c: char| !c.is_ascii_digit())
        .map(|i| input.split_at(i))
        .ok_or_else(|| ParseError::InvalidFormat(input.to_string()))?;

    let value: u64 = num_str
        .parse()
        .map_err(|_| ParseError::InvalidFormat(input.to_string()))?;

    match unit {
        "us" => Ok(Duration::from_micros(value)),
        "ms" => Ok(Duration::from_millis(value)),
        "s" => Ok(Duration::from_secs(value)),
        "m" => Ok(Duration::from_secs(value * 60)),
        _ => Err(ParseError::UnknownUnit(unit.to_string())),
    }
}
```

## Step 5: Run Tests - Verify PASS

```bash
$ cargo test
test duration::tests::test_parse_duration ... ok

test result: ok. 1 passed; 0 failed
```

✓ All tests passing!

## Step 6: Check Coverage

```bash
$ cargo llvm-cov
Filename       Regions  Miss  Cover  Lines  Miss  Cover
duration.rs         12     0 100.0%     18     0 100.0%
TOTAL               12     0 100.0%     18     0 100.0%
```

✓ Coverage: 100%

## TDD Complete!
````

## Test Patterns

### Table-Driven Tests
```rust
let cases = vec![
    ("name", input, expected),
    ("name2", input2, expected2),
];

for (name, input, expected) in cases {
    let result = function(input);
    assert_eq!(result, expected, "FAILED: {name}");
}
```

### Async Tests
```rust
#[tokio::test]
async fn fetches_data() {
    let result = fetch_data().await.unwrap();
    assert!(!result.is_empty());
}
```

### Property-Based Tests
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn roundtrip(value: i64) {
        let encoded = encode(value);
        prop_assert_eq!(decode(&encoded).unwrap(), value);
    }
}
```

## Coverage Commands

```bash
# Preferred: cargo-llvm-cov
cargo llvm-cov --html
cargo llvm-cov --fail-under-lines 80

# Alternative: cargo-tarpaulin
cargo tarpaulin --out Html
cargo tarpaulin --fail-under 80
```

## Coverage Targets

| Code Type | Target |
|-----------|--------|
| Critical business logic | 100% |
| Public APIs | 90%+ |
| General code | 80%+ |
| Generated/derived code | Exclude |

## TDD Best Practices

**DO:**
- Write test FIRST, before any implementation
- Run tests after each change
- Use table-driven tests for comprehensive coverage
- Test behavior, not implementation details
- Include edge cases (empty, zero, max values, invalid UTF-8)

**DON'T:**
- Write implementation before tests
- Skip the RED phase
- Test private functions directly (test through public API)
- Use `thread::sleep` in tests
- Ignore flaky tests

## Related Commands

- `/rust-build` — Fix build errors
- `/rust-review` — Review code after implementation
- `/verify` — Run full verification loop

## Related

- Skill: `skills/rust-testing/`
- Skill: `skills/tdd-workflow/`
