#!/usr/bin/env node
/**
 * PreToolUse hook for Write tool.
 * Warns if a .feature file name doesn't match the handler naming convention.
 * Convention: {HandlerName}Handler.cs → {HandlerName}.feature
 * Example: InsertHeaderHandler.cs → InsertHeader.feature
 */
let data = '';
const MAX_STDIN = 10 * 1024 * 1024; // 10MB
let dataLen = 0;
process.stdin.on('data', chunk => {
  dataLen += chunk.length;
  if (dataLen > MAX_STDIN) {
    process.stdout.write(data);
    process.exit(0);
  }
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || '';

    // Only check .feature files
    if (!filePath.endsWith('.feature')) {
      process.stdout.write(data);
      return;
    }

    const path = require('path');
    const featureName = path.basename(filePath, '.feature');

    // Check naming conventions
    const issues = [];

    // Feature files should be PascalCase
    if (featureName !== featureName.charAt(0).toUpperCase() + featureName.slice(1)) {
      issues.push(`Feature file "${featureName}.feature" should be PascalCase`);
    }

    // Feature files should not contain "Handler", "Command", "Query" suffixes
    if (/Handler$/.test(featureName)) {
      issues.push(`Feature file should not end with "Handler" — use "${featureName.replace(/Handler$/, '')}.feature" instead`);
    }
    if (/Command$/.test(featureName)) {
      issues.push(`Feature file should not end with "Command" — use "${featureName.replace(/Command$/, '')}.feature" instead`);
    }
    if (/Query$/.test(featureName)) {
      issues.push(`Feature file should not end with "Query" — use "${featureName.replace(/Query$/, '')}.feature" instead`);
    }

    // Feature files should not contain spaces or hyphens (use PascalCase)
    if (/[\s-]/.test(featureName)) {
      issues.push(`Feature file "${featureName}.feature" should use PascalCase, not spaces or hyphens`);
    }

    if (issues.length > 0) {
      console.error('[Hook] Feature file naming warning:');
      issues.forEach(issue => console.error(`[Hook]   - ${issue}`));
      console.error('[Hook] Convention: HandlerName minus "Handler" suffix = feature file name');
      console.error('[Hook]   InsertHeaderHandler.cs → InsertHeader.feature');
      // Warn only, don't block (exit 0)
    }
  } catch (e) {
    // Parse error — pass through silently
  }
  process.stdout.write(data);
});
