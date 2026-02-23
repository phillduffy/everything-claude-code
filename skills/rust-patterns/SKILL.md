---
name: rust-patterns
description: Rust patterns, best practices, and conventions from Microsoft's Rust Guidelines. Covers error handling, type design, async/Tokio, performance, documentation, crate organization, and static verification.
---

# Rust Development Patterns

Comprehensive Rust patterns and best practices for building robust, efficient, and maintainable applications. Based on Microsoft's Pragmatic Rust Guidelines.

## When to Activate

- Writing new Rust code
- Reviewing Rust code
- Refactoring existing Rust code
- Designing crate APIs or module structure

## Error Handling

### Application vs Library Errors

```rust
// Applications: use anyhow for ergonomic error propagation
use anyhow::{bail, Context, Result};

fn load_config(path: &Path) -> Result<Config> {
    let data = fs::read_to_string(path)
        .context("failed to read config file")?;
    let config: Config = toml::from_str(&data)
        .context("failed to parse config")?;
    if config.port == 0 {
        bail!("port must be non-zero");
    }
    Ok(config)
}

// Libraries: use thiserror for structured, typed errors
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("invalid header at byte {offset}")]
    InvalidHeader { offset: usize },
    #[error("unsupported version {version}")]
    UnsupportedVersion { version: u32 },
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
```

### Canonical Error Struct (Libraries)

```rust
#[derive(Debug, Error)]
#[error("{message}")]
pub struct ProtocolError {
    message: String,
    #[source]
    source: Option<Box<dyn std::error::Error + Send + Sync>>,
    backtrace: std::backtrace::Backtrace,
}

impl ProtocolError {
    /// Check if the error is retriable.
    pub fn is_retriable(&self) -> bool {
        // Expose behavior, not internal ErrorKind
        matches!(self.source.as_ref(), Some(e) if e.to_string().contains("timeout"))
    }
}
```

### Error Context Wrapping

```rust
// Good: wrap with context at every boundary
fn process_order(order_id: OrderId) -> Result<Receipt> {
    let order = db.get_order(order_id)
        .with_context(|| format!("fetch order {order_id}"))?;
    let payment = charge_payment(&order)
        .with_context(|| format!("charge payment for order {order_id}"))?;
    Ok(Receipt::new(order, payment))
}

// Bad: raw propagation loses context
fn process_order(order_id: OrderId) -> Result<Receipt> {
    let order = db.get_order(order_id)?; // Where did this fail?
    let payment = charge_payment(&order)?;
    Ok(Receipt::new(order, payment))
}
```

### Programming Bugs are Panics

```rust
// Panic on contract violations — these are bugs, not errors
fn get_element(slice: &[u8], index: usize) -> u8 {
    assert!(index < slice.len(), "index {index} out of bounds for len {}", slice.len());
    slice[index]
}

// NEVER panic for recoverable errors
// Bad: fn connect(addr: &str) -> Connection { ... .unwrap() }
// Good: fn connect(addr: &str) -> Result<Connection> { ... }
```

## Type Design

### Strong Types Over Primitives

```rust
// Bad: primitive obsession
fn transfer(from: u64, to: u64, amount: f64) -> Result<()> { todo!() }

// Good: strong types prevent misuse at compile time
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AccountId(u64);

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
pub struct Currency(f64);

fn transfer(from: AccountId, to: AccountId, amount: Currency) -> Result<()> { todo!() }
```

### Builder Pattern (4+ Parameters)

```rust
pub struct ServerConfig {
    addr: SocketAddr,
    max_connections: usize,
    timeout: Duration,
    tls: Option<TlsConfig>,
}

pub struct ServerConfigBuilder {
    addr: SocketAddr,
    max_connections: usize,
    timeout: Duration,
    tls: Option<TlsConfig>,
}

impl ServerConfig {
    pub fn builder(addr: SocketAddr) -> ServerConfigBuilder {
        ServerConfigBuilder {
            addr,
            max_connections: 1024,
            timeout: Duration::from_secs(30),
            tls: None,
        }
    }
}

impl ServerConfigBuilder {
    pub fn max_connections(mut self, n: usize) -> Self {
        self.max_connections = n;
        self
    }

    pub fn timeout(mut self, d: Duration) -> Self {
        self.timeout = d;
        self
    }

    pub fn tls(mut self, config: TlsConfig) -> Self {
        self.tls = Some(config);
        self
    }

    pub fn build(self) -> ServerConfig {
        ServerConfig {
            addr: self.addr,
            max_connections: self.max_connections,
            timeout: self.timeout,
            tls: self.tls,
        }
    }
}
```

### Hide Smart Pointers

```rust
// Bad: leaks Arc in public API
pub struct Database {
    pub pool: Arc<Pool>,
}

// Good: hide internals, implement Clone via Arc<Inner>
pub struct Database {
    inner: Arc<DatabaseInner>,
}

struct DatabaseInner {
    pool: Pool,
}

impl Clone for Database {
    fn clone(&self) -> Self {
        Database { inner: Arc::clone(&self.inner) }
    }
}

impl Database {
    pub fn new(pool: Pool) -> Self {
        Database { inner: Arc::new(DatabaseInner { pool }) }
    }
}
```

### Ergonomic APIs with AsRef/Into

```rust
// Accept flexible input — callers can pass &str, String, PathBuf, etc.
pub fn read_config(path: impl AsRef<Path>) -> Result<Config> {
    let path = path.as_ref();
    let data = fs::read_to_string(path)?;
    toml::from_str(&data).map_err(Into::into)
}

// Accept Into for owned parameters
pub fn set_name(mut self, name: impl Into<String>) -> Self {
    self.name = name.into();
    self
}
```

## Async & Tokio

### Ensure Futures are Send

```rust
// Compile-time assertion that a future is Send
fn assert_send<T: Send>(_: &T) {}

async fn handle_request(req: Request) -> Response {
    let fut = process(req);
    assert_send(&fut);
    fut.await
}

// Common cause of !Send futures: holding non-Send types across .await
// Bad: MutexGuard held across await
async fn bad() {
    let guard = mutex.lock().unwrap();
    some_async_op().await; // guard is !Send, future is !Send
    drop(guard);
}

// Good: drop before await
async fn good() {
    let data = {
        let guard = mutex.lock().unwrap();
        guard.clone()
    };
    some_async_op().await;
}
```

### Cooperative Yielding

```rust
// Long CPU-bound work in async context must yield
async fn process_large_batch(items: &[Item]) -> Vec<Result> {
    let mut results = Vec::with_capacity(items.len());
    for (i, item) in items.iter().enumerate() {
        results.push(process_item(item));
        // Yield every 100 items to avoid starving other tasks
        if i % 100 == 0 {
            tokio::task::yield_now().await;
        }
    }
    results
}
```

### Structured Concurrency with Tokio

```rust
use tokio::task::JoinSet;

async fn fetch_all(urls: Vec<String>) -> Vec<Result<Response>> {
    let mut set = JoinSet::new();
    for url in urls {
        set.spawn(async move {
            reqwest::get(&url).await
        });
    }

    let mut results = Vec::new();
    while let Some(res) = set.join_next().await {
        results.push(res.unwrap_or_else(|e| Err(e.into())));
    }
    results
}
```

### Graceful Shutdown

```rust
use tokio::signal;
use tokio_util::sync::CancellationToken;

async fn run_server(token: CancellationToken) {
    let listener = TcpListener::bind("0.0.0.0:8080").await.unwrap();

    loop {
        tokio::select! {
            Ok((stream, _)) = listener.accept() => {
                let token = token.clone();
                tokio::spawn(async move {
                    handle_connection(stream, token).await;
                });
            }
            _ = token.cancelled() => {
                tracing::info!("shutting down gracefully");
                break;
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let token = CancellationToken::new();
    let server_token = token.clone();

    tokio::spawn(async move {
        signal::ctrl_c().await.unwrap();
        token.cancel();
    });

    run_server(server_token).await;
}
```

### Sans-IO Pattern

```rust
// Accept impl Read/Write for one-shot I/O — enables flexible composition
fn parse_message(reader: &mut impl Read) -> Result<Message> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)?;
    let len = u32::from_be_bytes(buf) as usize;
    let mut payload = vec![0u8; len];
    reader.read_exact(&mut payload)?;
    Message::decode(&payload)
}

// Works with files, network streams, in-memory buffers, etc.
let msg = parse_message(&mut file)?;
let msg = parse_message(&mut Cursor::new(bytes))?;
```

## Performance

### mimalloc as Global Allocator

```rust
// In main.rs or lib.rs — ~15-25% improvement on allocation-heavy workloads
use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;
```

### Avoid Unnecessary Clones

```rust
// Bad: cloning when a reference suffices
fn process(data: &Data) {
    let copy = data.clone(); // unnecessary allocation
    compute(&copy);
}

// Good: borrow where possible
fn process(data: &Data) {
    compute(data);
}

// Bad: String where &str suffices
fn greet(name: String) -> String {
    format!("Hello, {name}")
}

// Good: accept borrowed data
fn greet(name: &str) -> String {
    format!("Hello, {name}")
}
```

### Benchmarking with criterion/divan

```rust
// Cargo.toml
// [dev-dependencies]
// criterion = { version = "0.5", features = ["html_reports"] }
//
// [[bench]]
// name = "my_benchmark"
// harness = false
//
// [profile.bench]
// debug = 1  # Enable debug symbols for profiling

// benches/my_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_parse(c: &mut Criterion) {
    let input = include_str!("../testdata/large.json");
    c.bench_function("parse_json", |b| {
        b.iter(|| parse(black_box(input)))
    });
}

criterion_group!(benches, bench_parse);
criterion_main!(benches);
```

## Documentation

### Canonical Sections

```rust
/// Sends a message to the specified recipient.
///
/// Delivers the message through the configured transport, retrying up to
/// `max_retries` times on transient failures. Messages are serialized using
/// the protocol's binary format before transmission.
///
/// # Examples
///
/// ```
/// let client = Client::new(config)?;
/// client.send("user@example.com", Message::text("hello"))?;
/// ```
///
/// # Errors
///
/// Returns [`SendError::Transport`] if the connection fails after all retries.
/// Returns [`SendError::Serialization`] if the message cannot be encoded.
///
/// # Panics
///
/// Panics if `recipient` is empty.
pub fn send(&self, recipient: &str, message: Message) -> Result<(), SendError> {
    assert!(!recipient.is_empty(), "recipient must not be empty");
    // ...
    todo!()
}
```

### Module Documentation

```rust
//! HTTP client for the Widget API.
//!
//! This module provides a high-level client for interacting with the Widget
//! service. It handles authentication, retries, and rate limiting.
//!
//! # Examples
//!
//! ```no_run
//! use widget::Client;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let client = Client::from_env()?;
//!     let widgets = client.list_widgets().await?;
//!     println!("Found {} widgets", widgets.len());
//!     Ok(())
//! }
//! ```
```

## Crate Organization

### Feature Additivity

```toml
# Cargo.toml — features must be additive, never disable functionality
[features]
default = ["std"]
std = []           # Prefer "std" over "no-std"
tls = ["dep:rustls"]
compression = ["dep:flate2"]
# All combinations must compile: std+tls, tls+compression, etc.
```

### No Glob Re-exports

```rust
// Bad: glob re-exports leak internal structure changes
pub use crate::types::*;

// Good: explicit re-exports
pub use crate::types::{Config, Error, Result};

// Use #[doc(inline)] for re-exported items
#[doc(inline)]
pub use crate::types::Config;
```

### Smaller Crates Preferred

Split crates when submodules can be used independently. Use features for optional functionality within a crate.

## Naming

### Weasel-Free Names

```rust
// Bad: generic names that say nothing
struct BookingManager;
struct DataService;
struct EventFactory;

// Good: specific names that describe behavior
struct Bookings;           // or BookingRegistry
struct BookingDispatcher;  // if it dispatches
struct EventBuilder;       // Builder, not Factory
```

### Named Constants Over Magic Values

```rust
// Bad: magic values
if retries > 3 { ... }
let timeout = Duration::from_secs(30);

// Good: documented constants
const MAX_RETRIES: u32 = 3;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

if retries > MAX_RETRIES { ... }
let timeout = DEFAULT_TIMEOUT;
```

### Rust Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Types, Traits | CamelCase | `HttpClient`, `IntoIterator` |
| Functions, methods | snake_case | `read_to_string`, `push_back` |
| Constants | SCREAMING_SNAKE | `MAX_BUFFER_SIZE` |
| Modules, crates | snake_case | `std::io`, `serde_json` |
| Conversions | `as_`/`to_`/`into_` | `as_bytes`, `to_string`, `into_inner` |
| Getters | field name (no `get_`) | `fn len()`, not `fn get_len()` |
| Constructors | `new` or `with_` | `Vec::new()`, `Vec::with_capacity()` |

## Traits & Functions

### Essential Functions are Inherent

```rust
// Core functionality belongs in impl blocks, not traits
impl Config {
    pub fn load(path: impl AsRef<Path>) -> Result<Self> { todo!() }
    pub fn port(&self) -> u16 { self.port }
}

// Trait methods forward to inherent methods
impl Default for Config {
    fn default() -> Self {
        Config::load("config.toml").unwrap_or_else(|_| Config {
            port: 8080,
            // ...
        })
    }
}
```

### Common Trait Implementations

Always implement these traits on public types where applicable:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(String);

impl Display for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// Send + Sync are auto-derived when all fields are Send + Sync
// Ensure pub types are Send + Sync unless there's a reason not to be
```

## Static Verification

### Clippy Configuration

```toml
# Cargo.toml — recommended lint configuration
[lints.rust]
unsafe_op_in_unsafe_fn = "warn"
missing_debug_implementations = "warn"

[lints.clippy]
# Enable major groups at priority -1 (below specific overrides)
cargo = { level = "warn", priority = -1 }
complexity = { level = "warn", priority = -1 }
correctness = { level = "warn", priority = -1 }
pedantic = { level = "warn", priority = -1 }
perf = { level = "warn", priority = -1 }
style = { level = "warn", priority = -1 }
suspicious = { level = "warn", priority = -1 }

# Selective restriction lints
undocumented_unsafe_blocks = "warn"
string_to_string = "warn"
allow_attributes_without_reason = "warn"
clone_on_ref_ptr = "warn"
dbg_macro = "warn"
print_stderr = "warn"
print_stdout = "warn"
rest_pat_in_fully_bound_structs = "warn"
unnecessary_self_imports = "warn"

# Commonly-disabled pedantic lints (override as needed)
must_use_candidate = "allow"
missing_errors_doc = "allow"
missing_panics_doc = "allow"
module_name_repetitions = "allow"
```

### Use #[expect] Not #[allow]

```rust
// Bad: stale allow — won't warn when lint is no longer triggered
#[allow(dead_code)]
fn old_function() {}

// Good: expect — warns if the lint isn't triggered (catch stale overrides)
#[expect(dead_code, reason = "keeping for backward compatibility until v2")]
fn old_function() {}
```

### Tooling

```bash
# Format
cargo fmt --check

# Lint
cargo clippy -- -D warnings

# Security audit (use cargo-deny — superset of cargo-audit)
cargo deny check

# Feature combination validation
cargo hack check --feature-powerset

# Unused dependency detection
cargo udeps

# Unsafe code validation
cargo +nightly miri test
```

## Logging with tracing

### Structured Events

```rust
use tracing::{info, warn, instrument};

#[instrument(skip(db))]
async fn process_order(db: &Database, order_id: OrderId) -> Result<Receipt> {
    info!(order_id = %order_id, "processing order");

    let order = db.get_order(order_id).await
        .context("fetch order")?;

    info!(
        order_id = %order_id,
        items = order.items.len(),
        total = %order.total,
        "order fetched"
    );

    let receipt = charge(&order).await?;

    info!(
        order_id = %order_id,
        receipt_id = %receipt.id,
        "order.processing.success"
    );

    Ok(receipt)
}
```

### Subscriber Setup

```rust
use tracing_subscriber::{fmt, EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

fn init_tracing() {
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(fmt::layer().json()) // JSON output for production
        .init();
}
```

### Redact Sensitive Data

```rust
// Never log PII, tokens, or secrets
// Bad:
info!(token = %user_token, "authenticating");

// Good:
info!(token.redacted = true, user_id = %user_id, "authenticating");
```

## Safety

### Avoid unsafe — If Unavoidable, Follow These Rules

1. **Document the safety reasoning** in a `// SAFETY:` comment
2. **Test with Miri**: `cargo +nightly miri test`
3. **Keep the unsafe block minimal** — extract safe wrappers
4. **Soundness is non-negotiable** — no safe code must be able to trigger UB

```rust
// SAFETY: We've verified that `index < self.len` in the check above,
// so this access is within bounds.
unsafe { *self.data.get_unchecked(index) }
```

## Common Crate Patterns

### serde — Serialization

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse {
    pub request_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(flatten)]
    pub data: ResponseData,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseData {
    Success { items: Vec<Item> },
    Error { code: u32 },
}
```

### axum — Web Framework

```rust
use axum::{extract::{Path, State}, http::StatusCode, Json, Router, routing::get};

async fn get_user(
    State(db): State<Database>,
    Path(id): Path<UserId>,
) -> Result<Json<User>, AppError> {
    let user = db.get_user(id).await?;
    Ok(Json(user))
}

fn app(db: Database) -> Router {
    Router::new()
        .route("/users/{id}", get(get_user))
        .with_state(db)
}

// Centralized error handling
struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        tracing::error!(error = %self.0, "request failed");
        (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
    }
}

impl<E: Into<anyhow::Error>> From<E> for AppError {
    fn from(err: E) -> Self { AppError(err.into()) }
}
```

### clap — CLI Argument Parsing

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "myapp", about = "Does cool things")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    #[arg(short, long, default_value = "info")]
    log_level: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Run the server
    Serve {
        #[arg(short, long, default_value = "8080")]
        port: u16,
    },
    /// Run database migrations
    Migrate,
}
```

### sqlx — Database

```rust
use sqlx::{PgPool, FromRow};

#[derive(Debug, FromRow)]
struct User {
    id: i64,
    name: String,
    email: String,
}

async fn get_user(pool: &PgPool, id: i64) -> Result<User> {
    let user = sqlx::query_as!(User, "SELECT id, name, email FROM users WHERE id = $1", id)
        .fetch_one(pool)
        .await
        .context("fetch user")?;
    Ok(user)
}

// Connection pool setup
let pool = PgPool::connect(&database_url).await?;
sqlx::migrate!().run(&pool).await?;
```

### reqwest — HTTP Client

```rust
use reqwest::Client;

// Reuse the client (connection pooling)
let client = Client::builder()
    .timeout(Duration::from_secs(10))
    .build()?;

let response = client
    .get("https://api.example.com/data")
    .bearer_auth(&token)
    .send()
    .await
    .context("API request failed")?
    .error_for_status()
    .context("API returned error status")?
    .json::<ApiResponse>()
    .await
    .context("failed to parse API response")?;
```

## Anti-Patterns — NEVER Do These

| Anti-Pattern | Why | Fix |
|---|---|---|
| `.unwrap()` in non-test code | Panics in production | Use `?`, `.context()`, or `bail!()` |
| `panic!()` for recoverable errors | Terminates the process | Return `Result<T, E>` |
| `pub use foo::*` | Leaks internal structure | Explicit re-exports |
| Leaked `Arc`/`Rc`/`Box` in pub API | Constrains implementation | Accept `&T`/`T`, hide wrappers |
| Magic numbers/strings | Undocumented behavior | Named constants |
| Weasel names (Manager/Service) | No semantic meaning | Specific descriptive names |
| `#[allow]` without `reason` | Stale lint suppression | `#[expect(lint, reason = "...")]` |
| Holding `MutexGuard` across `.await` | Blocks executor, !Send | Clone data, drop guard before await |
| `format!()` in SQL queries | SQL injection | Parameterized queries (`$1`) |
| `unsafe` without SAFETY comment | Unverified invariants | Document reasoning, test with Miri |
| Statics for shared state | Version duplication | `Arc<Inner>` pattern |
| Hot-spinning (busy loops) | Wastes CPU cycles | `tokio::time::sleep`, channels |

**Remember**: Rust's type system and ownership model are your greatest tools. Lean into the compiler — if it compiles and Clippy is happy, you're most of the way to correct code.
