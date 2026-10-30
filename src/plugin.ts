// hashline-edit — OpenCode plugin for hash-validated line-based editing
// Provides the `hashline_edit` tool with LINE#ID format

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Types
// ============================================================================

interface RawHashlineEdit {
  op: 'replace' | 'append' | 'prepend' | 'replace_text';
  pos?: string;
  end?: string;
  lines?: string | string[] | null;
  oldText?: string;
  newText?: string;
}

interface HashlineEdit {
  op: 'replace' | 'append' | 'prepend' | 'replace_text';
  pos?: string;
  end?: string;
  lines?: string | string[];
  oldText?: string;
  newText?: string;
}

interface ApplyResult {
  content: string;
  noopEdits: number;
  deduplicatedEdits: number;
  freshAnchors: Array<{ line: number; hash: string; content: string }>;
}

interface CanonicalEnvelope {
  content: string;
  lineHashes: Map<number, string>;
}

interface HashlineEditArgs {
  filePath: string;
  delete?: boolean;
  rename?: string;
  hashLength?: number;
  edits?: RawHashlineEdit[];
}

interface ToolContext {
  sessionID: string;
  messageID: string;
  signal: AbortSignal;
  progress: (update: Record<string, unknown>) => Promise<void>;
  metadata?: (value: unknown) => void;
}

// ============================================================================
// Constants
// ============================================================================

const NIBBLE_STR = 'ZPMQVRWSNKTXJBYH';
const DEFAULT_HASH_LENGTH = 2;

function buildHashDict(hashLength: number): string[] {
  const dict: string[] = [];
  const combinations = Math.pow(16, hashLength);
  for (let i = 0; i < combinations; i++) {
    let hash = '';
    let value = i;
    for (let j = 0; j < hashLength; j++) {
      hash = NIBBLE_STR[value & 0x0f] + hash;
      value >>>= 4;
    }
    dict.push(hash);
  }
  return dict;
}

const HASHLINE_DICT_2 = buildHashDict(2);

function buildRefPattern(hashLength: number): RegExp {
  return new RegExp(`^([0-9]+)#([${NIBBLE_STR}]{${hashLength}})$`);
}

function buildOutputPattern(hashLength: number): RegExp {
  return new RegExp(`^([0-9]+)#([${NIBBLE_STR}]{${hashLength}})\\\\|(.*)$`);
}

const HASHLINE_REF_PATTERN = buildRefPattern(DEFAULT_HASH_LENGTH);
const HASHLINE_OUTPUT_PATTERN = buildOutputPattern(DEFAULT_HASH_LENGTH);

// ============================================================================
// Validation
// ============================================================================

class HashlineMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HashlineMismatchError';
  }
}

class NoopLoopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoopLoopError';
  }
}

function computeLineHash(content: string, hashLength = DEFAULT_HASH_LENGTH): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  if (hashLength === 2) {
    const high = (hash >>> 4) & 0x0f;
    const low = hash & 0x0f;
    return `${NIBBLE_STR[high & 0x0f]}${NIBBLE_STR[low & 0x0f]}`;
  }
  const hashStr = hash.toString(16).padStart(8, '0');
  return hashStr.slice(-hashLength).toUpperCase().replace(/[0-9A-F]/g, (c) => NIBBLE_STR[parseInt(c, 16) % NIBBLE_STR.length]);
}

function computeContextHash(lines: string[], lineIndex: number, hashLength = DEFAULT_HASH_LENGTH): string {
  const contextLines: string[] = [];
  if (lineIndex > 0) contextLines.push(lines[lineIndex - 1]);
  contextLines.push(lines[lineIndex]);
  if (lineIndex < lines.length - 1) contextLines.push(lines[lineIndex + 1]);
  return computeLineHash(contextLines.join('\n'), hashLength);
}

function getRefPattern(hashLength: number): RegExp {
  return buildRefPattern(hashLength);
}

function getOutputPattern(hashLength: number): RegExp {
  return buildOutputPattern(hashLength);
}

function validateLineRefs(lines: string[], refs: Map<string, { line: number; hash: string }>, hashLength = DEFAULT_HASH_LENGTH): void {
  for (const [ref, { line, hash }] of refs) {
    if (line < 1 || line > lines.length) {
      throw new HashlineMismatchError(`Line ${line} out of range (1-${lines.length}) for ref ${ref}`);
    }
    const actualHash = computeContextHash(lines, line - 1, hashLength);
    if (actualHash !== hash) {
      throw new HashlineMismatchError(
        `Hash mismatch at line ${line}: expected ${hash}, got ${actualHash}. ` +
          `File content may have changed. Re-read the file and use fresh LINE#ID tags.`
      );
    }
  }
}

function parseLineRef(ref: string, hashLength = DEFAULT_HASH_LENGTH): { line: number; hash: string } | null {
  const pattern = getRefPattern(hashLength);
  const match = ref.match(pattern);
  if (!match) return null;
  return { line: parseInt(match[1], 10), hash: match[2] };
}

function formatLineRef(line: number, hash: string): string {
  return `${line}#${hash}`;
}

// Noop loop tracking
const noopLoopCounter = new Map<string, number>();

function checkNoopLoop(filePath: string): void {
  const count = noopLoopCounter.get(filePath) ?? 0;
  if (count >= 3) {
    noopLoopCounter.delete(filePath);
    throw new NoopLoopError(
      `Three consecutive no-op edits on ${filePath}. File content unchanged. Re-read and provide different content.`
    );
  }
  noopLoopCounter.set(filePath, count + 1);
}

function resetNoopLoop(filePath: string): void {
  noopLoopCounter.delete(filePath);
}

// ============================================================================
// Edit Operation Primitives
// ============================================================================

function isReplaceEdit(edit: HashlineEdit): boolean { return edit.op === 'replace'; }
function isAppendEdit(edit: HashlineEdit): boolean { return edit.op === 'append'; }
function isPrependEdit(edit: HashlineEdit): boolean { return edit.op === 'prepend'; }
function isReplaceTextEdit(edit: HashlineEdit): boolean { return edit.op === 'replace_text'; }

function applySetLine(lines: string[], posRef: string, newLines: string | string[], hashLength = 2): string[] {
  const parsed = parseLineRef(posRef, hashLength);
  if (!parsed) throw new Error(`Invalid pos ref: ${posRef}`);
  const { line } = parsed;

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split('\n');
  const result = [...lines];

  if (line >= 1 && line <= result.length) {
    result[line - 1] = linesArr.join('\n');
  } else if (line === result.length + 1) {
    result.push(...linesArr);
  } else {
    throw new Error(`Line ${line} out of range (1-${result.length + 1})`);
  }
  return result;
}

function applyReplaceLines(lines: string[], posRef: string, endRef: string, newLines: string | string[], hashLength = 2): string[] {
  const parsedPos = parseLineRef(posRef, hashLength);
  const parsedEnd = parseLineRef(endRef, hashLength);
  if (!parsedPos || !parsedEnd) throw new Error(`Invalid pos/end ref`);

  const { line: startLine } = parsedPos;
  const { line: endLine } = parsedEnd;

  if (startLine < 1 || endLine > lines.length || startLine > endLine) {
    throw new Error(`Invalid range: ${startLine}-${endLine} (file has ${lines.length} lines)`);
  }

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split('\n');
  const result = [...lines];
  result.splice(startLine - 1, endLine - startLine + 1, ...linesArr);
  return result;
}

function applyInsertAfter(lines: string[], posRef: string, newLines: string | string[], hashLength = 2): string[] {
  const parsed = parseLineRef(posRef, hashLength);
  if (!parsed) throw new Error(`Invalid pos ref: ${posRef}`);
  const { line } = parsed;

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split('\n');
  const result = [...lines];

  if (line >= 0 && line <= result.length) {
    result.splice(line, 0, ...linesArr);
  } else {
    throw new Error(`Line ${line} out of range for insert-after (0-${result.length})`);
  }
  return result;
}

function applyInsertBefore(lines: string[], posRef: string, newLines: string | string[], hashLength = 2): string[] {
  const parsed = parseLineRef(posRef, hashLength);
  if (!parsed) throw new Error(`Invalid pos ref: ${posRef}`);
  const { line } = parsed;

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split('\n');
  const result = [...lines];

  if (line >= 1 && line <= result.length + 1) {
    result.splice(line - 1, 0, ...linesArr);
  } else {
    throw new Error(`Line ${line} out of range for insert-before (1-${result.length + 1})`);
  }
  return result;
}

function applyAppend(lines: string[], newLines: string | string[]): string[] {
  const linesArr = Array.isArray(newLines) ? newLines : newLines.split('\n');
  return [...lines, ...linesArr];
}

function applyPrepend(lines: string[], newLines: string | string[]): string[] {
  const linesArr = Array.isArray(newLines) ? newLines : newLines.split('\n');
  return [...linesArr, ...lines];
}

function applyReplaceText(lines: string[], oldText: string, newText: string): string[] {
  const content = lines.join('\n');
  const index = content.indexOf(oldText);
  if (index === -1) throw new Error(`Text not found: "${oldText}"`);
  const secondIndex = content.indexOf(oldText, index + 1);
  if (secondIndex !== -1) throw new Error(`Text matches multiple locations: "${oldText}"`);
  const newContent = content.slice(0, index) + newText + content.slice(index + oldText.length);
  return newContent.split('\n');
}

// ============================================================================
// Edit Ordering & Deduplication
// ============================================================================

function getEditLineNumber(edit: HashlineEdit): number {
  if (edit.op === 'replace' && edit.pos) {
    const parsed = parseLineRef(edit.pos);
    if (parsed) return parsed.line;
  }
  if (edit.op === 'append' && edit.pos) {
    const parsed = parseLineRef(edit.pos);
    if (parsed) return parsed.line;
  }
  if (edit.op === 'prepend' && edit.pos) {
    const parsed = parseLineRef(edit.pos);
    if (parsed) return parsed.line;
  }
  if (edit.op === 'replace_text') return -1;
  return Infinity;
}

function collectLineRefs(edits: HashlineEdit[]): Map<string, { line: number; hash: string }> {
  const refs = new Map<string, { line: number; hash: string }>();
  for (const edit of edits) {
    if (edit.op === 'replace') {
      if (edit.pos) { const parsed = parseLineRef(edit.pos); if (parsed) refs.set(edit.pos, parsed); }
      if (edit.end) { const parsed = parseLineRef(edit.end); if (parsed) refs.set(edit.end, parsed); }
    }
    if (edit.op === 'append' && edit.pos) {
      const parsed = parseLineRef(edit.pos);
      if (parsed) refs.set(edit.pos, parsed);
    }
    if (edit.op === 'prepend' && edit.pos) {
      const parsed = parseLineRef(edit.pos);
      if (parsed) refs.set(edit.pos, parsed);
    }
  }
  return refs;
}

function detectOverlappingRanges(edits: HashlineEdit[]): string | null {
  const ranges: Array<{ start: number; end: number; edit: HashlineEdit }> = [];
  for (const edit of edits) {
    if (edit.op !== 'replace') continue;
    const start = edit.pos ? parseLineRef(edit.pos)?.line ?? 0 : 0;
    const end = edit.end ? parseLineRef(edit.end)?.line ?? start : start;
    if (start > 0) ranges.push({ start, end, edit });
  }
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 0; i < ranges.length - 1; i++) {
    if (ranges[i].end >= ranges[i + 1].start) {
      const editA = ranges[i].edit;
      const editB = ranges[i + 1].edit;
      const endA = editA.op === 'replace' ? editA.end : '';
      const endB = editB.op === 'replace' ? editB.end : '';
      const posA = editA.op === 'replace' ? editA.pos : '';
      const posB = editB.op === 'replace' ? editB.pos : '';
      return `Overlapping edits: ${posA}–${endA} overlaps ${posB}–${endB}`;
    }
  }
  return null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function editKey(edit: HashlineEdit): string {
  const parts: string[] = [edit.op];
  if (isReplaceEdit(edit)) {
    if (edit.pos) parts.push('pos:' + edit.pos);
    if (edit.end) parts.push('end:' + edit.end);
  }
  if (isAppendEdit(edit) && edit.pos) parts.push('pos:' + edit.pos);
  if (isPrependEdit(edit) && edit.pos) parts.push('pos:' + edit.pos);
  if (isReplaceTextEdit(edit)) {
    parts.push('oldText:' + edit.oldText);
    parts.push('newText:' + edit.newText);
  } else {
    const lines = Array.isArray(edit.lines) ? edit.lines.join('\n') : edit.lines;
    parts.push('lines:' + lines);
  }
  return parts.join('|');
}

function dedupeEdits(edits: HashlineEdit[]): { edits: HashlineEdit[]; deduplicatedEdits: number } {
  const seen = new Map<string, HashlineEdit>();
  let deduplicatedEdits = 0;
  for (const edit of edits) {
    const key = editKey(edit);
    if (seen.has(key)) deduplicatedEdits++;
    else seen.set(key, edit);
  }
  return { edits: Array.from(seen.values()), deduplicatedEdits };
}

function generateFreshAnchors(lines: string[], hashLength: number): Array<{ line: number; hash: string; content: string }> {
  return lines.map((line, index) => ({
    line: index + 1,
    hash: computeContextHash(lines, index, hashLength),
    content: line,
  }));
}

// ============================================================================
// Apply Edits
// ============================================================================

function applyHashlineEditsWithReport(content: string, edits: HashlineEdit[], hashLength = 2): ApplyResult {
  if (edits.length === 0) {
    return { content, noopEdits: 0, deduplicatedEdits: 0, freshAnchors: generateFreshAnchors(content.split('\n'), hashLength) };
  }

  const dedupeResult = dedupeEdits(edits);
  const EDIT_PRECEDENCE: Record<string, number> = { replace: 0, append: 1, prepend: 2, replace_text: 3 };

  const sortedEdits = [...dedupeResult.edits].sort((a, b) => {
    const lineA = getEditLineNumber(a);
    const lineB = getEditLineNumber(b);
    if (lineB !== lineA) return lineB - lineA;
    return (EDIT_PRECEDENCE[a.op] ?? 3) - (EDIT_PRECEDENCE[b.op] ?? 3);
  });

  let noopEdits = 0;
  let lines = content.length === 0 ? [] : content.split('\n');

  const refs = collectLineRefs(sortedEdits);
  if (refs.size > 0) validateLineRefs(lines, refs, hashLength);

  const overlapError = detectOverlappingRanges(sortedEdits);
  if (overlapError) throw new Error(overlapError);

  for (const edit of sortedEdits) {
    switch (edit.op) {
      case 'replace': {
        const next = edit.end
          ? applyReplaceLines(lines, edit.pos!, edit.end, edit.lines!, hashLength)
          : applySetLine(lines, edit.pos!, edit.lines!, hashLength);
        if (arraysEqual(next, lines)) { noopEdits++; break; }
        lines = next;
        break;
      }
      case 'append': {
        const next = edit.pos
          ? applyInsertAfter(lines, edit.pos, edit.lines!, hashLength)
          : applyAppend(lines, edit.lines!);
        if (arraysEqual(next, lines)) { noopEdits++; break; }
        lines = next;
        break;
      }
      case 'prepend': {
        const next = edit.pos
          ? applyInsertBefore(lines, edit.pos, edit.lines!, hashLength)
          : applyPrepend(lines, edit.lines!);
        if (arraysEqual(next, lines)) { noopEdits++; break; }
        lines = next;
        break;
      }
      case 'replace_text': {
        const next = applyReplaceText(lines, edit.oldText!, edit.newText!);
        if (arraysEqual(next, lines)) { noopEdits++; break; }
        lines = next;
        break;
      }
    }
  }

  const freshAnchors = generateFreshAnchors(lines, hashLength);
  return { content: lines.join('\n'), noopEdits, deduplicatedEdits: dedupeResult.deduplicatedEdits, freshAnchors };
}

// ============================================================================
// File Canonicalization
// ============================================================================

function canonicalizeFileText(rawContent: string, hashLength = 2): CanonicalEnvelope {
  const content = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = content.split('\n');
  const lineHashes = new Map<number, string>();
  const canonicalLines: string[] = [];
  const outputPattern = buildOutputPattern(hashLength);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(buildOutputPattern(hashLength));
    if (match) {
      canonicalLines.push(match[3]);
      lineHashes.set(i + 1, match[2]);
    } else {
      canonicalLines.push(line);
      lineHashes.set(i + 1, computeContextHash(canonicalLines, canonicalLines.length - 1, hashLength));
    }
  }
  return { content: canonicalLines.join('\n'), lineHashes };
}

function restoreFileText(canonicalContent: string, envelope: CanonicalEnvelope, hashLength = 2): string {
  const lines = canonicalContent.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const hash = envelope.lineHashes.get(i + 1);
    if (hash) result.push(`${lines[i]} ${i + 1}#${hash}`);
    else result.push(lines[i]);
  }
  return result.join('\n');
}

// ============================================================================
// Diff Utilities
// ============================================================================

function countLineDiffs(before: string, after: string): { additions: number; deletions: number } {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  let additions = 0, deletions = 0;
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < maxLen; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b !== undefined && a === undefined) deletions++;
    else if (b === undefined && a !== undefined) additions++;
    else if (b !== a) { deletions++; additions++; }
  }
  return { additions, deletions };
}

function generateUnifiedDiff(before: string, after: string, filePath: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const diff: string[] = [];
  diff.push(`--- ${filePath}`);
  diff.push(`+++ ${filePath}`);
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < maxLen; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a) continue;
    if (b !== undefined) diff.push(`-${b}`);
    if (a !== undefined) diff.push(`+${a}`);
  }
  return diff.join('\n');
}

// ============================================================================
// Formatter Trigger (stub)
// ============================================================================

async function runFormattersForFile(_client: unknown, _directory: string, _filePath: string): Promise<void> {
  // Stub - formatters would be triggered via OpenCode API if available
}

// ============================================================================
// Normalize Edits
// ============================================================================

function normalizeHashlineEdits(rawEdits: RawHashlineEdit[], hashLength = 2): HashlineEdit[] {
  const refPattern = buildRefPattern(hashLength);
  return rawEdits.map((raw): HashlineEdit => {
    if (raw.op === 'replace') {
      const lines = raw.lines === null || raw.lines === undefined ? [] : raw.lines;
      const edit: HashlineEdit = { op: 'replace', lines, pos: raw.pos ?? '', end: raw.end ?? '' };
      if (raw.pos) validateRef(raw.pos, buildRefPattern(hashLength));
      if (raw.end) validateRef(raw.end, buildRefPattern(hashLength));
      return edit;
    }
    if (raw.op === 'append') {
      const lines = raw.lines === null || raw.lines === undefined ? [] : raw.lines;
      const edit: HashlineEdit = { op: 'append', lines, pos: raw.pos ?? '' };
      if (raw.pos) validateRef(raw.pos, buildRefPattern(hashLength));
      return edit;
    }
    if (raw.op === 'prepend') {
      const lines = raw.lines === null || raw.lines === undefined ? [] : raw.lines;
      const edit: HashlineEdit = { op: 'prepend', lines, pos: raw.pos ?? '' };
      if (raw.pos) validateRef(raw.pos, buildRefPattern(hashLength));
      return edit;
    }
    if (raw.op === 'replace_text') {
      if (!raw.oldText) throw new Error('replace_text requires oldText');
      if (!raw.newText) throw new Error('replace_text requires newText');
      return { op: 'replace_text', oldText: raw.oldText, newText: raw.newText };
    }
    throw new Error(`Unknown op: ${raw.op}`);
  });
}

function validateRef(ref: string, pattern: RegExp): void {
  if (!ref.match(pattern)) {
    throw new Error(`Invalid LINE#ID format: "${ref}". Expected format: "LINE#ID" (e.g., "42#ZP")`);
  }
}

// ============================================================================
// Plugin Definition
// ============================================================================

const HASHLINE_EDIT_DESCRIPTION = `Edit files using LINE#ID format for precise, safe modifications.

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
\`\`
Use these fresh anchors directly in the next edit call without re-reading.

## READING FILES
When you read a file, each line includes its LINE#ID tag:
\`\`\`
const x = 1          1#ZP
function foo() {     2#AB
  return x + 1       3#CD
}                    4#EF
\`\`\`
Copy the LINE#ID tags exactly as shown for your edits.`;

// ============================================================================
// Tool Execution
// ============================================================================

async function executeHashlineEditTool(
  args: HashlineEditArgs,
  _toolContext: unknown,
  pluginContext: { client?: unknown }
): Promise<string> {
  try {
    const filePath = args.filePath;
    const { delete: deleteMode, rename, hashLength = DEFAULT_HASH_LENGTH } = args;

    if (deleteMode && rename) return 'Error: delete and rename cannot be used together';
    if (deleteMode && (args.edits?.length ?? 0) > 0) return 'Error: delete mode requires edits to be an empty array';
    if (!deleteMode && (!args.edits || !Array.isArray(args.edits) || args.edits.length === 0)) {
      return 'Error: edits parameter must be a non-empty array';
    }

    const edits = deleteMode ? [] : normalizeHashlineEdits(args.edits ?? [], hashLength);

    // Read file using Node.js fs
    let rawOldContent = '';
    let exists = false;
    try {
      rawOldContent = await fs.promises.readFile(filePath, 'utf-8');
      exists = true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }

    if (!exists && !deleteMode) {
      const canCreate = edits.length > 0 && edits.every(e => (e.op === 'append' || e.op === 'prepend') && !e.pos);
      if (!canCreate) return `Error: File not found: ${filePath}`;
    }

    if (deleteMode) {
      if (!exists) return `Error: File not found: ${filePath}`;
      await fs.promises.unlink(filePath);
      return `Successfully deleted ${filePath}`;
    }

    const oldEnvelope = canonicalizeFileText(rawOldContent, hashLength);
    const applyResult = applyHashlineEditsWithReport(oldEnvelope.content, edits, hashLength);
    const canonicalNewContent = applyResult.content;

    // Noop loop guard
    if (canonicalNewContent === oldEnvelope.content && !rename) {
      try { checkNoopLoop(filePath); }
      catch (e) { if (e instanceof NoopLoopError) return `Error: ${e.message}`; throw e; }
      let diagnostic = `No changes made to ${filePath}. The edits produced identical content.`;
      if (applyResult.noopEdits > 0) {
        diagnostic += ` No-op edits: ${applyResult.noopEdits}. Re-read the file and provide content that differs from current lines.`;
      }
      return `Error: ${diagnostic}`;
    }

    resetNoopLoop(filePath);

    const writeContent = restoreFileText(canonicalNewContent, oldEnvelope, hashLength);

    // Write file using Node.js fs
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, writeContent, 'utf-8');

    // Run formatters if client available
    if (pluginContext.client) {
      try {
        const formattedContent = await fs.promises.readFile(filePath, 'utf-8');
        if (formattedContent !== writeContent) {
          const formattedEnvelope = canonicalizeFileText(formattedContent, hashLength);
          if (rename && rename !== filePath) {
            await fs.promises.mkdir(path.dirname(rename), { recursive: true });
            await fs.promises.writeFile(rename, formattedContent, 'utf-8');
            await fs.promises.unlink(filePath);
            return `Moved ${filePath} to ${rename}`;
          }
          return `Updated ${filePath} (formatted)`;
        }
      } catch {}
    }

    if (rename && rename !== filePath) {
      await fs.promises.mkdir(path.dirname(rename), { recursive: true });
      await fs.promises.writeFile(rename, writeContent, 'utf-8');
      await fs.promises.unlink(filePath);
      return `Moved ${filePath} to ${rename}`;
    }

    const freshAnchors = applyResult.freshAnchors?.map(a => `${a.line}#${a.hash}|${a.content}`).join('\n') || '';
    const anchorOutput = freshAnchors ? `\n--- Fresh Anchors ---\n${freshAnchors}` : '';
    return `Updated ${filePath}${anchorOutput}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof HashlineMismatchError) {
      return `Error: hash mismatch - ${message}\nTip: reuse LINE#ID entries from the latest read/edit output, or batch related edits in one call.`;
    }
    if (error instanceof NoopLoopError) {
      return `Error: ${message}`;
    }
    return `Error: ${message}`;
  }
}

// ============================================================================
// Plugin Entry Point
// ============================================================================

const TOOL_NAME = 'hashline_edit';

export const hashlineEditPlugin = async ({ $ }: { $: { tool: { transform: (fn: (editor: any) => void) => Promise<any> } } }) => {
  // Register the tool via the tool API
  const toolRegistration = await $.tool.transform((editor: any) => {
    editor.add({
      name: TOOL_NAME,
      description: HASHLINE_EDIT_DESCRIPTION,
      input: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file to edit' },
          delete: { type: 'boolean', description: 'Delete file instead of editing' },
          rename: { type: 'string', description: 'Rename output file path after edits' },
          hashLength: { type: 'number', description: 'Hash length 2-4 (default: 2)', minimum: 2, maximum: 4 },
          edits: {
            type: 'array',
            description: 'Array of edit operations to apply (empty when delete=true)',
            items: {
              type: 'object',
              properties: {
                op: { type: 'string', enum: ['replace', 'append', 'prepend', 'replace_text'], description: 'Hashline edit operation mode' },
                pos: { type: 'string', description: 'Primary anchor in LINE#ID format (e.g., \'42#ZP\')' },
                end: { type: 'string', description: 'Range end anchor in LINE#ID format (e.g., \'45#WS\')' },
                lines: { type: ['array', 'string'], description: 'Replacement or inserted lines (for replace/append/prepend)', items: { type: 'string' } },
                oldText: { type: 'string', description: 'Exact text to find (for replace_text)' },
                newText: { type: 'string', description: 'Replacement text (for replace_text)' },
              },
              required: ['op'],
            },
          },
        },
        required: ['filePath'],
      },
      execute: async (input: HashlineEditArgs) => {
        const result = await executeHashlineEditTool(input, {} as never, { client: undefined });
        return { content: result };
      },
    });
  });

  return { dispose: () => toolRegistration.dispose() };
}

export default { hashlineEditPlugin };
