---
paths:
  - "**/*.cs"
  - "**/*.csproj"
---
# C# Security

> This file extends [common/security.md](../common/security.md) with C# specific content.

## SQL Injection Prevention

Always use parameterized queries:

```csharp
// EF Core — Good
var users = await _db.Users.Where(u => u.Email == email).ToListAsync();

// EF Core Raw SQL — Good
var users = await _db.Users
    .FromSqlInterpolated($"SELECT * FROM Users WHERE Email = {email}")
    .ToListAsync();

// Dapper — Good
var user = await conn.QueryAsync<User>(
    "SELECT * FROM Users WHERE Id = @Id", new { Id = userId });

// BAD: String concatenation
var sql = $"SELECT * FROM Users WHERE Id = {userId}"; // NEVER
```

## Banned APIs

- **BinaryFormatter** — remote code execution risk, use `System.Text.Json`
- **TypeNameHandling.All** in Newtonsoft — deserialization attacks
- **Process.Start** with unsanitized input — command injection
- **dynamic** type — bypasses type safety

## Process Execution

```csharp
// Good: Explicit arguments, no shell
var process = new Process
{
    StartInfo = new ProcessStartInfo
    {
        FileName = "tool.exe",
        Arguments = $"--id {Uri.EscapeDataString(userId)}",
        UseShellExecute = false
    }
};

// BAD: Shell execution with user input
Process.Start("cmd", $"/c echo {userInput}"); // NEVER
```

## Secret Management

```csharp
// Good: IConfiguration / environment
var apiKey = configuration["ApiKey"]
    ?? throw new InvalidOperationException("ApiKey not configured");

// Good: User secrets in development
// dotnet user-secrets set "ApiKey" "value"
```
