---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Hooks

> This file extends [common/hooks.md](../common/hooks.md) with C# specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **dotnet format**: Auto-format `.cs` files after edit
- **dotnet build**: Verify build after editing `.cs` or `.csproj` files
- **dotnet test**: Run affected tests after implementation changes

## Example Hook Configuration

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "dotnet format --include $FILE_PATH --verbosity quiet",
        "filePattern": "*.cs"
      }
    ]
  }
}
```
