/**
 * Read-side anchors: the tool description promises that every line the model
 * reads carries its LINE#ID, so the anchors must be added to the read output.
 * The hash covers the line and its neighbours, so it is computed against the
 * whole file, not against the window the read returned.
 */

import { canonicalizeFileText } from "./file-text-canonicalization.js"
import { computeContextHash, getOutputPattern } from "./validation.js"
import { DEFAULT_HASH_LENGTH } from "./constants.js"

const READ_LINE = /^\s*(\d+):\s?(.*)$/

export function tagReadContent(
  readContent: string,
  fileContent: string,
  hashLength: number = DEFAULT_HASH_LENGTH,
): string {
  const fileLines = canonicalizeFileText(fileContent, hashLength).content.split("\n")
  const outputPattern = getOutputPattern(hashLength)
  const lines = readContent.split("\n")
  let tagged = 0

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (outputPattern.test(line)) continue
    const match = line.match(READ_LINE)
    if (!match) continue
    const lineNumber = Number(match[1])
    if (lineNumber < 1 || lineNumber > fileLines.length) continue
    const hash = computeContextHash(fileLines, lineNumber - 1, hashLength)
    lines[index] = `${lineNumber}#${hash}|${match[2]}`
    tagged++
  }

  return tagged === 0 ? readContent : lines.join("\n")
}
