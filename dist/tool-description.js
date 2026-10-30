/**
 * Hashline edit tool description
 */
export const HASHLINE_EDIT_DESCRIPTION = `Edit files using LINE#ID format for precise, safe modifications.

## LINE#ID FORMAT
Each line is identified by: \`LINE#ID\` where ID is a 2-char hash of line content.
Example: \`42#ZP\` means line 42 with content hash "ZP".

## HOW IT WORKS
1. Read file → output shows each line with its LINE#ID tag
2. Use those exact LINE#ID tags as anchors for edits
3. Before applying, tool verifies content hashes match (prevents conflicts)
4. Edits applied atomically with deduplication and overlap detection

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

## SPECIAL CASES
- \`delete: true\` with empty edits → deletes file
- \`rename: "new/path"\` → moves file after edits
- Multiple edits batched in one call → applied atomically, sorted by line (bottom-up)

## SAFETY
- Hash validation prevents editing stale content
- Overlapping edits rejected
- No-op edits reported
- Formatters run automatically after write (if configured)

## READING FILES
When you read a file, each line includes its LINE#ID tag:
\`\`\`
const x = 1          1#ZP
function foo() {     2#AB
  return x + 1       3#CD
}                    4#EF
\`\`\`
Copy the LINE#ID tags exactly as shown for your edits.`;
//# sourceMappingURL=tool-description.js.map