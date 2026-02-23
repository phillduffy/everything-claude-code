---
name: rust-testing
description: Rust testing patterns including unit tests, integration tests, async tests, table-driven style, property-based testing, benchmarks, mocking, coverage, and TDD workflow.
---

# Rust Testing Patterns

Comprehensive Rust testing patterns for writing reliable, maintainable tests following TDD methodology.

## When to Activate

- Writing new Rust functions or methods
- Adding test coverage to existing code
- Creating benchmarks for performance-critical code
- Implementing property-based or fuzz tests
- Following TDD workflow in Rust projects

## TDD Workflow

### The RED-GREEN-REFACTOR Cycle

```
RED     → Define types/traits, write #[test] functions that fail
GREEN   → Implement minimal code to pass
REFACTOR → Improve while tests stay green
REPEAT  → Next requirement
```

### Step-by-Step TDD in Rust

```rust
// Step 1: Define the signature
// src/validator.rs
pub fn validate_email(email: &str) -> Result<(), ValidationError> {
    todo!()
}

#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("email cannot be empty")]
    Empty,
    #[error("invalid email format: {0}")]
    InvalidFormat(String),
}

// Step 2: Write failing tests (RED)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_email_passes() {
        assert!(validate_email("user@example.com").is_ok());
    }

    #[test]
    fn empty_email_fails() {
        let err = validate_email("").unwrap_err();
        assert!(matches!(err, ValidationError::Empty));
    }

    #[test]
    fn missing_at_sign_fails() {
        assert!(validate_email("userexample.com").is_err());
    }
}

// Step 3: Run tests — verify FAIL
// $ cargo test
// thread panicked at 'not yet implemented'

// Step 4: Implement minimal code (GREEN)
pub fn validate_email(email: &str) -> Result<(), ValidationError> {
    if email.is_empty() {
        return Err(ValidationError::Empty);
    }
    if !email.contains('@') || !email.contains('.') {
        return Err(ValidationError::InvalidFormat(email.to_string()));
    }
    Ok(())
}

// Step 5: Run tests — verify PASS
// $ cargo test -- PASS

// Step 6: Refactor (improve regex, etc.) while keeping tests green
```

## Unit Tests

### Basic Test Module Pattern

```rust
// src/math.rs
pub fn gcd(a: u64, b: u64) -> u64 {
    if b == 0 { a } else { gcd(b, a % b) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gcd_of_coprime_numbers() {
        assert_eq!(gcd(14, 15), 1);
    }

    #[test]
    fn gcd_with_zero() {
        assert_eq!(gcd(5, 0), 5);
        assert_eq!(gcd(0, 5), 5);
    }

    #[test]
    #[should_panic(expected = "divide by zero")]
    fn panics_on_invalid_input() {
        risky_divide(1, 0);
    }
}
```

### Assertion Macros

```rust
#[test]
fn assertions_demo() {
    // Equality
    assert_eq!(actual, expected, "values should match: got {actual}");
    assert_ne!(a, b);

    // Boolean
    assert!(condition, "expected condition to be true");

    // Pattern matching
    assert!(matches!(result, Ok(Value::Number(_))));
    assert!(matches!(err, Err(Error::NotFound { .. })));

    // Float comparison (no direct eq)
    assert!((actual - expected).abs() < f64::EPSILON);
}
```

## Table-Driven Tests

Rust's standard approach for comprehensive test coverage with minimal code.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_duration() {
        let cases = vec![
            ("1s", Ok(Duration::from_secs(1))),
            ("500ms", Ok(Duration::from_millis(500))),
            ("2m", Ok(Duration::from_secs(120))),
            ("", Err(ParseError::Empty)),
            ("abc", Err(ParseError::InvalidFormat)),
            ("-1s", Err(ParseError::Negative)),
        ];

        for (input, expected) in cases {
            let result = parse_duration(input);
            assert_eq!(
                result, expected,
                "parse_duration({input:?}) = {result:?}, expected {expected:?}"
            );
        }
    }
}
```

### Table-Driven with Named Cases

```rust
#[test]
fn test_slug_generation() {
    struct Case {
        name: &'static str,
        input: &'static str,
        expected: &'static str,
    }

    let cases = vec![
        Case { name: "simple", input: "Hello World", expected: "hello-world" },
        Case { name: "special chars", input: "Foo & Bar!", expected: "foo-bar" },
        Case { name: "multiple spaces", input: "a   b", expected: "a-b" },
        Case { name: "unicode", input: "Ünïcödë", expected: "unicode" },
        Case { name: "empty", input: "", expected: "" },
    ];

    for case in cases {
        assert_eq!(
            slugify(case.input), case.expected,
            "FAILED: {} — slugify({:?})", case.name, case.input
        );
    }
}
```

## Integration Tests

### tests/ Directory Pattern

```
my_crate/
├── src/
│   └── lib.rs
├── tests/
│   ├── integration_test.rs   # Each file is a separate test binary
│   ├── api_tests.rs
│   └── common/
│       └── mod.rs             # Shared test helpers
```

```rust
// tests/common/mod.rs — shared helpers
pub fn setup_test_db() -> Database {
    let db = Database::connect("sqlite::memory:").unwrap();
    db.migrate().unwrap();
    db
}

// tests/api_tests.rs
mod common;

#[test]
fn create_and_fetch_user() {
    let db = common::setup_test_db();
    let user = db.create_user("alice", "alice@example.com").unwrap();
    let fetched = db.get_user(user.id).unwrap();
    assert_eq!(fetched.name, "alice");
}
```

## Async Tests

### tokio::test Macro

```rust
#[tokio::test]
async fn fetch_returns_data() {
    let server = MockServer::start().await;
    server.register(Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true}))))
        .await;

    let client = Client::new(server.uri());
    let result = client.fetch().await.unwrap();
    assert!(result.ok);
}
```

### Timeout Pattern

```rust
#[tokio::test]
async fn operation_completes_within_timeout() {
    let result = tokio::time::timeout(
        Duration::from_secs(5),
        long_running_operation(),
    ).await;

    assert!(result.is_ok(), "operation timed out");
    assert!(result.unwrap().is_ok());
}
```

### Testing Cancellation

```rust
#[tokio::test]
async fn task_handles_cancellation() {
    let token = CancellationToken::new();
    let task_token = token.clone();

    let handle = tokio::spawn(async move {
        graceful_worker(task_token).await
    });

    // Let it run briefly
    tokio::time::sleep(Duration::from_millis(100)).await;
    token.cancel();

    // Should complete without panic
    let result = handle.await.unwrap();
    assert!(result.is_ok());
}
```

## Property-Based Testing with proptest

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn roundtrip_serialize(value: i64) {
        let encoded = encode(value);
        let decoded = decode(&encoded).unwrap();
        prop_assert_eq!(decoded, value);
    }

    #[test]
    fn sort_is_idempotent(mut vec in prop::collection::vec(any::<i32>(), 0..100)) {
        vec.sort();
        let sorted = vec.clone();
        vec.sort();
        prop_assert_eq!(vec, sorted);
    }

    #[test]
    fn string_contains_after_push(base in "\\PC*", suffix in "\\PC*") {
        let combined = format!("{base}{suffix}");
        prop_assert!(combined.contains(&base));
        prop_assert!(combined.contains(&suffix));
    }
}
```

## Fuzzing with cargo-fuzz

```rust
// fuzz/fuzz_targets/parse_input.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use my_crate::parse;

fuzz_target!(|data: &[u8]| {
    // Should never panic on arbitrary input
    let _ = parse(data);
});
```

```bash
# Setup
cargo install cargo-fuzz

# Run fuzzer
cargo +nightly fuzz run parse_input -- -max_total_time=60

# Minimize crash input
cargo +nightly fuzz tmin parse_input artifacts/parse_input/crash-...
```

## Benchmarking

### criterion Setup

```toml
# Cargo.toml
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }

[[bench]]
name = "my_benchmark"
harness = false

[profile.bench]
debug = 1  # Enable debug symbols for profiling
```

```rust
// benches/my_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};

fn bench_sort_algorithms(c: &mut Criterion) {
    let mut group = c.benchmark_group("sorting");

    for size in [100, 1_000, 10_000] {
        let data: Vec<i32> = (0..size).rev().collect();

        group.bench_with_input(
            BenchmarkId::new("std_sort", size),
            &data,
            |b, data| {
                b.iter(|| {
                    let mut v = data.clone();
                    v.sort();
                    black_box(v)
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("unstable_sort", size),
            &data,
            |b, data| {
                b.iter(|| {
                    let mut v = data.clone();
                    v.sort_unstable();
                    black_box(v)
                })
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_sort_algorithms);
criterion_main!(benches);
```

```bash
# Run benchmarks
cargo bench

# Run specific benchmark
cargo bench -- sorting

# Compare against baseline
cargo bench -- --save-baseline main
# ... make changes ...
cargo bench -- --baseline main
```

### divan (Alternative)

```rust
fn main() {
    divan::main();
}

#[divan::bench(args = [100, 1_000, 10_000])]
fn sort_vec(n: usize) -> Vec<i32> {
    let mut v: Vec<i32> = (0..n as i32).rev().collect();
    v.sort();
    v
}
```

## Mocking

### Interface-Based Mocking (Sans-IO)

```rust
// Accept impl Read/Write for mockable I/O
fn process_stream(input: &mut impl Read, output: &mut impl Write) -> Result<usize> {
    let mut buf = Vec::new();
    input.read_to_end(&mut buf)?;
    let processed = transform(&buf);
    output.write_all(&processed)?;
    Ok(processed.len())
}

#[test]
fn test_process_stream() {
    let input_data = b"hello world";
    let mut input = Cursor::new(input_data);
    let mut output = Vec::new();

    let len = process_stream(&mut input, &mut output).unwrap();

    assert_eq!(len, 11);
    assert_eq!(output, b"HELLO WORLD");
}
```

### Mock Controller Pattern

```rust
// Feature-gated test utilities
#[cfg(feature = "test-util")]
pub fn mock() -> (Client, MockController) {
    let ctrl = MockController::new();
    let client = Client::from_mock(ctrl.clone());
    (client, ctrl)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_retries_on_failure() {
        let (client, ctrl) = Client::mock();
        ctrl.enqueue_response(StatusCode::SERVICE_UNAVAILABLE);
        ctrl.enqueue_response(StatusCode::OK);

        let result = client.get("/data").unwrap();
        assert_eq!(ctrl.request_count(), 2);
    }
}
```

### Trait-Based Mocking

```rust
trait Storage {
    fn get(&self, key: &str) -> Option<Vec<u8>>;
    fn set(&mut self, key: &str, value: Vec<u8>);
}

// Production implementation
struct DiskStorage { /* ... */ }
impl Storage for DiskStorage { /* ... */ }

// Test double
struct InMemoryStorage {
    data: HashMap<String, Vec<u8>>,
}

impl Storage for InMemoryStorage {
    fn get(&self, key: &str) -> Option<Vec<u8>> {
        self.data.get(key).cloned()
    }
    fn set(&mut self, key: &str, value: Vec<u8>) {
        self.data.insert(key.to_string(), value);
    }
}

#[test]
fn cache_stores_and_retrieves() {
    let mut store = InMemoryStorage { data: HashMap::new() };
    let cache = Cache::new(&mut store);
    cache.put("key", b"value".to_vec());
    assert_eq!(cache.get("key"), Some(b"value".to_vec()));
}
```

## Test Coverage

### cargo-llvm-cov (Preferred)

```bash
# Install
cargo install cargo-llvm-cov

# Run with HTML report
cargo llvm-cov --html
open target/llvm-cov/html/index.html

# Run with summary
cargo llvm-cov

# With specific coverage threshold
cargo llvm-cov --fail-under-lines 80

# Exclude test code from coverage
cargo llvm-cov --ignore-filename-regex 'tests?/'
```

### cargo-tarpaulin (Alternative)

```bash
# Install
cargo install cargo-tarpaulin

# Run with HTML report
cargo tarpaulin --out Html
open tarpaulin-report.html

# With threshold
cargo tarpaulin --fail-under 80

# Exclude patterns
cargo tarpaulin --exclude-files "tests/*" --exclude-files "benches/*"
```

### Coverage Targets

| Code Type | Target |
|-----------|--------|
| Critical business logic | 100% |
| Public APIs | 90%+ |
| General code | 80%+ |
| Generated/derived code | Exclude |

## Avoid Statics in Tests

```rust
// Bad: shared mutable static — causes test interference
static mut COUNTER: u32 = 0;

#[test]
fn test_a() {
    unsafe { COUNTER += 1; }
    // Tests run in parallel — race condition!
}

// Good: dependency injection
fn process(counter: &AtomicU32) -> u32 {
    counter.fetch_add(1, Ordering::SeqCst)
}

#[test]
fn test_process() {
    let counter = AtomicU32::new(0);
    assert_eq!(process(&counter), 0);
    assert_eq!(process(&counter), 1);
}
```

## Test Commands

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Run tests matching pattern
cargo test parse_

# Run tests in specific module
cargo test --lib math::tests

# Run integration tests only
cargo test --test integration_test

# Run doc tests only
cargo test --doc

# Run with thread count
cargo test -- --test-threads=1

# Run benchmarks
cargo bench

# Run with coverage
cargo llvm-cov --html

# Fuzz testing
cargo +nightly fuzz run target_name -- -max_total_time=60
```

## CI/CD Integration

```yaml
# GitHub Actions
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable

    - name: Run tests
      run: cargo test

    - name: Run clippy
      run: cargo clippy -- -D warnings

    - name: Check formatting
      run: cargo fmt --check

    - name: Coverage
      run: |
        cargo install cargo-llvm-cov
        cargo llvm-cov --fail-under-lines 80
```

## Best Practices

**DO:**
- Write tests FIRST (TDD)
- Use table-driven tests for exhaustive coverage
- Test behavior, not implementation details
- Use `#[cfg(test)]` for test modules
- Prefer integration tests over unit tests for public APIs
- Use `assert!` with descriptive messages
- Test error paths as thoroughly as success paths

**DON'T:**
- Use `#[allow(unused)]` to silence test warnings — fix them
- Use `thread::sleep` in tests — use channels or async primitives
- Ignore flaky tests — fix root cause or quarantine
- Mock everything — prefer real implementations when fast enough
- Use statics for test state — inject dependencies
- Skip the RED phase — seeing tests fail validates they test something

**Remember**: Tests are executable documentation. They show how your code is meant to be used and what invariants it maintains. Keep them clear, fast, and deterministic.
