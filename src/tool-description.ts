/**
 * Hashline edit tool description
 */

export const HASHLINE_EDIT_DESCRIPTION = `Edit files using LINE#ID format for precise, safe modifications.

## LINE#ID FORMAT
Each line is identified by: \`LINE#ID\` where ID is a 2-char hash of line content (configurable 2-4 chars).
Example: \`42#ZP\` means line 42 with content hash "ZP".

## HOW IT WORKS
1. Read file → output shows each line with its LINE#ID tag
2. Use those exact LINE#ID tags as anchors for edits
3. Before applying, tool verifies content hashes match (prevents conflicts)
4. Edits applied atomically with deduplication and overlap detection
5. Successful edits return fresh anchors for chained edits without re-reading

## OPERATIONS

### replace
Replace a single line or range of lines.
- \`pos\`: LINE#ID of target line (or start of range)
- \`end\`: LINE#ID of end line (optional, for range)
- \`lines\`: New content (string or string[])

\`\`\`json
{ "op": "replace", "pos": "42#ZP", "lines": "new content" }
{ "op": "replace", "pos": "10#AB", "end": "15#CD", "lines": ["line1", "line2"] }
\`\`\`

### append
Insert lines AFTER a given line, or at end of file.
- \`pos\`: LINE#ID after which to insert (optional, defaults to end)
- \`lines\`: Content to insert

\`\`\`json
{ "op": "append", "pos": "20#EF", "lines": "inserted after line 20" }
{ "op": "append", "lines": "added at end of file" }
\`\`\`

### prepend
Insert lines BEFORE a given line, or at start of file.
- \`pos\`: LINE#ID before which to insert (optional, defaults to start)
- \`lines\`: Content to insert

\`\`\`json
{ "op": "prepend", "pos": "5#GH", "lines": "inserted before line 5" }
{ "op": "prepend", "lines": "added at start of file" }
\`\`\`

### replace_text
Replace an exact unique substring without line anchors.
- \`oldText\`: Exact text to find (must match exactly once)
- \`newText\`: Replacement text

\`\`\`json
{ "op": "replace_text", "oldText": "function foo()", "newText": "function bar()" }
\`\`\`

## SPECIAL CASES
- \`delete: true\` with empty edits → deletes file
- \`rename: "new/path"\` → moves file after edits
- \`hashLength: 2-4\` → configure hash length (default 2)
- Multiple edits batched in one call → applied atomically, sorted by line (bottom-up)

## SAFETY
- Hash validation prevents editing stale content (context-aware: includes neighbor lines)
- Overlapping edits rejected
- No-op edits reported; 3 consecutive no-ops throws error
- Formatters run automatically after write (if configured)
- Strict patch content: no diff markers or display prefixes allowed

## CHAINED EDITS
After a successful edit, the result includes fresh LINE#ID anchors for the changed region:
\`\`\`
Updated src/file.ts
--- Fresh Anchors ---
42#ZP|function bar() {
43#KT|  return 42
44#WS|}
\`\`\`
Use these fresh anchors directly in the next edit call without re-reading.

## READING FILES
The \`read\` tool is wrapped: every line comes back as \`LINE#ID|content\`.
\`\`\`
1#ZP|const x = 1
2#AB|function foo() {
3#CD|  return x + 1
4#EF|}
\`\`\`
Copy the LINE#ID tags exactly as shown for your edits. A read with \`offset\`
and \`limit\` carries correct hashes too, because they are computed against the
whole file.`