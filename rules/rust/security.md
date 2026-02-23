---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
  - "**/Cargo.lock"
---
# Rust Security

> This file extends [common/security.md](../common/security.md) with Rust specific content.

## Secret Management

```rust
let api_key = std::env::var("API_KEY")
    .context("API_KEY not configured")?;
```

Never hardcode secrets in source code.

## Security Scanning

Use **cargo-deny** as the primary security tool (superset of cargo-audit):

```bash
# Initialize baseline config
cargo deny init

# Run all checks: advisories, licenses, bans, sources
cargo deny check
```

## Unsafe Code

- Avoid `unsafe` unless absolutely necessary
- If unavoidable: document `// SAFETY:` reasoning, test with Miri, keep blocks minimal
- Soundness is non-negotiable — no safe code may trigger UB
