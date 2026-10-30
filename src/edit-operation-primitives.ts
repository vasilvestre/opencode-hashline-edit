import { HashlineEdit, isReplaceEdit, isAppendEdit, isPrependEdit } from "./types"

export function applySetLine(
  lines: string[],
  posRef: string,
  newLines: string | string[],
  _options: { skipValidation?: boolean } = {},
): string[] {
  const parsed = parsePos(posRef)
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
  _options: { skipValidation?: boolean } = {},
): string[] {
  const parsedPos = parsePos(posRef)
  const parsedEnd = parsePos(endRef)
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
  _options: { skipValidation?: boolean } = {},
): string[] {
  const parsed = parsePos(posRef)
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
  _options: { skipValidation?: boolean } = {},
): string[] {
  const parsed = parsePos(posRef)
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

function parsePos(ref: string): { line: number } | null {
  const match = ref.match(/^([0-9]+)#([A-Z0-9]{2})$/)
  if (!match) return null
  return { line: parseInt(match[1], 10) }
}