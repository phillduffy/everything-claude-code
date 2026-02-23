# Agent Orchestration

## Available Agents

Located in `~/.claude/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design | Architectural decisions |
| architecture-enforcer | Dependency & layer enforcement | Verify architecture rules |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code review | After writing code |
| csharp-reviewer | C# code review | After writing C# code |
| csharp-build-resolver | Fix C# build errors | When dotnet build fails |
| csharp-architecture-enforcer | C# architecture enforcement | Verify C# layer boundaries |
| database-reviewer | Database review | Schema/query changes |
| go-reviewer | Go code review | After writing Go code |
| go-build-resolver | Fix Go build errors | When go build fails |
| python-reviewer | Python code review | After writing Python code |
| rust-reviewer | Rust code review | After writing Rust code |
| rust-build-resolver | Fix Rust build errors | When cargo build fails |
| vsto-reviewer | VSTO add-in review | After writing VSTO code |
| vsto-architecture-enforcer | VSTO architecture enforcement | Verify VSTO layer boundaries |
| security-reviewer | Security analysis | Before commits |
| build-error-resolver | Fix build errors | When build fails |
| e2e-runner | E2E testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation | Updating docs |

## Immediate Agent Usage

No user prompt needed:
1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker
