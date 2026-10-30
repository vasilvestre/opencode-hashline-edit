import { HashlineEdit, isReplaceEdit, isAppendEdit, isPrependEdit, isReplaceTextEdit } from "./types"
import { parseLineRef, computeContextHash } from "./validation"

export function applySetLine(
  lines: string[],
  posRef: string,
  newLines: string | string[],
  _options: { skipValidation?: boolean; hashLength?: number } = {},
): string[] {
  const { hashLength = 2 } = _options
  const parsed = parseLineRef(posRef, hashLength)
  if (!parsed) throw new Error(`Invalid pos ref: ${posRef}`)
  const { line } = parsed

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split("\n")
  const result = [...lines]

  if (line >= 1 && line <= result.length) {
    result[line - 1] = linesArr.join("\n")
  } else if (line === result.length + 1) {
    result.push(...linesArr)
  } else {
    throw new Error(`Line ${line} out of range (1-${result.length + 1})`)
  }

  return result
}

export function applyReplaceLines(
  lines: string[],
  posRef: string,
  endRef: string,
  newLines: string | string[],
  _options: { skipValidation?: boolean; hashLength?: number } = {},
): string[] {
  const { hashLength = 2 } = _options
  const parsedPos = parseLineRef(posRef, hashLength)
  const parsedEnd = parseLineRef(endRef, hashLength)
  if (!parsedPos || !parsedEnd) throw new Error(`Invalid pos/end ref`)

  const { line: startLine } = parsedPos
  const { line: endLine } = parsedEnd

  if (startLine < 1 || endLine > lines.length || startLine > endLine) {
    throw new Error(`Invalid range: ${startLine}-${endLine} (file has ${lines.length} lines)`)
  }

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split("\n")
  const result = [...lines]

  result.splice(startLine - 1, endLine - startLine + 1, ...linesArr)

  return result
}

export function applyInsertAfter(
  lines: string[],
  posRef: string,
  newLines: string | string[],
  _options: { skipValidation?: boolean; hashLength?: number } = {},
): string[] {
  const { hashLength = 2 } = _options
  const parsed = parseLineRef(posRef, hashLength)
  if (!parsed) throw new Error(`Invalid pos ref: ${posRef}`)
  const { line } = parsed

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split("\n")
  const result = [...lines]

  if (line >= 0 && line <= result.length) {
    result.splice(line, 0, ...linesArr)
  } else {
    throw new Error(`Line ${line} out of range for insert-after (0-${result.length})`)
  }

  return result
}

export function applyInsertBefore(
  lines: string[],
  posRef: string,
  newLines: string | string[],
  _options: { skipValidation?: boolean; hashLength?: number } = {},
): string[] {
  const { hashLength = 2 } = _options
  const parsed = parseLineRef(posRef, hashLength)
  if (!parsed) throw new Error(`Invalid pos ref: ${posRef}`)
  const { line } = parsed

  const linesArr = Array.isArray(newLines) ? newLines : newLines.split("\n")
  const result = [...lines]

  if (line >= 1 && line <= result.length + 1) {
    result.splice(line - 1, 0, ...linesArr)
  } else {
    throw new Error(`Line ${line} out of range for insert-before (1-${result.length + 1})`)
  }

  return result
}

export function applyAppend(lines: string[], newLines: string | string[]): string[] {
  const linesArr = Array.isArray(newLines) ? newLines : newLines.split("\n")
  return [...lines, ...linesArr]
}

export function applyPrepend(lines: string[], newLines: string | string[]): string[] {
  const linesArr = Array.isArray(newLines) ? newLines : newLines.split("\n")
  return [...linesArr, ...lines]
}

export function applyReplaceText(
  lines: string[],
  oldText: string,
  newText: string,
): string[] {
  const content = lines.join("\n")
  const index = content.indexOf(oldText)
  if (index === -1) {
    throw new Error(`Text not found: "${oldText}"`)
  }
  // Check for uniqueness
  const secondIndex = content.indexOf(oldText, index + 1)
  if (secondIndex !== -1) {
    throw new Error(`Text matches multiple locations: "${oldText}"`)
  }

  const newContent = content.slice(0, index) + newText + content.slice(index + oldText.length)
  return newContent.split("\n")
}