#!/usr/bin/env node
/**
 * PostToolUse Hook: Auto-format C# files with dotnet format after edits
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs after Edit/Write tool use. If the edited file is a .cs file,
 * formats it with `dotnet format`. Fails silently if dotnet isn't installed
 * or no solution/project is found.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MAX_STDIN = 1024 * 1024; // 1MB limit
let data = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  if (data.length < MAX_STDIN) {
    data += chunk;
  }
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path;

    if (filePath && /\.cs$/.test(filePath)) {
      try {
        const resolvedPath = path.resolve(filePath);
        const dir = path.dirname(resolvedPath);

        // Find nearest .sln or .csproj to scope dotnet format
        let searchDir = dir;
        let projectFile = null;
        for (let i = 0; i < 10; i++) {
          const entries = fs.readdirSync(searchDir);
          const sln = entries.find(e => e.endsWith('.sln'));
          if (sln) {
            projectFile = path.join(searchDir, sln);
            break;
          }
          const csproj = entries.find(e => e.endsWith('.csproj'));
          if (csproj) {
            projectFile = path.join(searchDir, csproj);
            break;
          }
          const parent = path.dirname(searchDir);
          if (parent === searchDir) break;
          searchDir = parent;
        }

        const args = ['format'];
        if (projectFile) {
          args.push(projectFile);
        }
        args.push('--include', resolvedPath, '--verbosity', 'quiet');

        execFileSync('dotnet', args, {
          cwd: searchDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000
        });
      } catch {
        // dotnet not installed, no project found, or format failed — non-blocking
      }
    }
  } catch {
    // Invalid input — pass through
  }

  process.stdout.write(data);
  process.exit(0);
});
