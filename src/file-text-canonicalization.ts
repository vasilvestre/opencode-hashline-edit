/**
 * File text canonicalization - normalizes line endings and extracts hashline tags
 */

import { computeLineHash, HASHLINE_OUTPUT_PATTERN } from "./validation"

export interface CanonicalEnvelope {
  content: string
  lineHashes: Map<number, string>
}

export function canonicalizeFileText(rawContent: string): CanonicalEnvelope {
  // Normalize line endings
  const content = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = content.split("\n")

  const lineHashes = new Map<number, string>()
  const canonicalLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(HASHLINE_OUTPUT_PATTERN)
    if (match) {
      // Line has hashline tag - strip it
      canonicalLines.push(match[3])
      lineHashes.set(i + 1, match[2])
    } else {
      canonicalLines.push(line)
      lineHashes.set(i + 1, computeLineHash(line))
    }
  }

  return {
    content: canonicalLines.join("\n"),
    lineHashes,
  }
}

export function restoreFileText(
  canonicalContent: string,
  envelope: CanonicalEnvelope,
): string {
  const lines = canonicalContent.split("\n")
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const hash = envelope.lineHashes.get(i + 1)
    if (hash) {
      result.push(`${lines[i]} ${i + 1}#${hash}`)
    } else {
      result.push(lines[i])
    }
  }

  return result.join("\n")
}