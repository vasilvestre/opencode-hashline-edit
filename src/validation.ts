/**
 * Validation utilities for hashline edits
 */

import { HashlineMismatchError, NoopLoopError } from "./types.js"
export { HashlineMismatchError, NoopLoopError } from "./types.js"
import { NIBBLE_STR, DEFAULT_HASH_LENGTH, MIN_HASH_LENGTH, MAX_HASH_LENGTH, buildRefPattern, buildOutputPattern, buildHashDict } from "./constants.js"

export function computeLineHash(content: string, hashLength: number = DEFAULT_HASH_LENGTH): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0
  }
  const dict = buildHashDict(hashLength)
  const high = (hash >>> 4) & 0x0f
  const low = hash & 0x0f
  // For hashLength > 2, we need more bits
  if (hashLength === 2) {
    return `${NIBBLE_STR[high & 0x0f]}${NIBBLE_STR[low & 0x0f]}`
  }
  // For 3-4 chars, use more of the hash
  const hashStr = hash.toString(16).padStart(8, "0")
  return hashStr.slice(-hashLength).toUpperCase().replace(/[0-9A-F]/g, (c) => NIBBLE_STR[parseInt(c, 16) % NIBBLE_STR.length])
}

export function computeContextHash(lines: string[], lineIndex: number, hashLength: number = DEFAULT_HASH_LENGTH): string {
  // Context-based hashing: include prev, curr, next lines
  const contextLines: string[] = []
  if (lineIndex > 0) contextLines.push(lines[lineIndex - 1])
  contextLines.push(lines[lineIndex])
  if (lineIndex < lines.length - 1) contextLines.push(lines[lineIndex + 1])
  const contextContent = contextLines.join("\n")
  return computeLineHash(contextContent, hashLength)
}

export const HASHLINE_REF_PATTERN = buildRefPattern(DEFAULT_HASH_LENGTH)
export const HASHLINE_OUTPUT_PATTERN = buildOutputPattern(DEFAULT_HASH_LENGTH)

export function getRefPattern(hashLength: number): RegExp {
  return buildRefPattern(hashLength)
}

export function getOutputPattern(hashLength: number): RegExp {
  return buildOutputPattern(hashLength)
}

export function validateLineRefs(
  lines: string[],
  refs: Map<string, { line: number; hash: string }>,
  hashLength: number = DEFAULT_HASH_LENGTH,
): void {
  for (const [ref, { line, hash }] of refs) {
    if (line < 1 || line > lines.length) {
      throw new HashlineMismatchError(
        `Line ${line} out of range (1-${lines.length}) for ref ${ref}`,
      )
    }
    const actualHash = computeContextHash(lines, line - 1, hashLength)
    if (actualHash !== hash) {
      throw new HashlineMismatchError(
        `Hash mismatch at line ${line}: expected ${hash}, got ${actualHash}. ` +
          `File content may have changed. Re-read the file and use fresh LINE#ID tags.`,
      )
    }
  }
}

export function parseLineRef(ref: string, hashLength: number = DEFAULT_HASH_LENGTH): { line: number; hash: string } | null {
  const pattern = getRefPattern(hashLength)
  const match = ref.match(pattern)
  if (!match) return null
  return { line: parseInt(match[1], 10), hash: match[2] }
}

export function formatLineRef(line: number, hash: string): string {
  return `${line}#${hash}`
}

// Noop loop tracking
const noopLoopCounter = new Map<string, number>()

export function checkNoopLoop(filePath: string): void {
  const count = noopLoopCounter.get(filePath) ?? 0
  if (count >= 3) {
    noopLoopCounter.delete(filePath)
    throw new NoopLoopError(
      `Three consecutive no-op edits on ${filePath}. File content unchanged. Re-read and provide different content.`,
    )
  }
  noopLoopCounter.set(filePath, count + 1)
}

export function resetNoopLoop(filePath: string): void {
  noopLoopCounter.delete(filePath)
}

export function incrementNoopLoop(filePath: string): void {
  const count = noopLoopCounter.get(filePath) ?? 0
  noopLoopCounter.set(filePath, count + 1)
}