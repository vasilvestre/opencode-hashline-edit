/**
 * Normalize raw hashline edits to internal format
 */

import { RawHashlineEdit } from "./types"
import { HashlineEdit } from "./types"
import { getRefPattern } from "./validation"

export function normalizeHashlineEdits(rawEdits: RawHashlineEdit[], hashLength: number = 2): HashlineEdit[] {
  const refPattern = getRefPattern(hashLength)
  
  return rawEdits.map((raw) => {
    if (raw.op === "replace") {
      const lines = normalizeLines(raw.lines)
      const edit: HashlineEdit = { op: "replace", lines, pos: raw.pos ?? "", end: raw.end }
      if (raw.pos) validateRef(raw.pos, refPattern)
      if (raw.end) validateRef(raw.end, refPattern)
      return edit
    }
    if (raw.op === "append") {
      const lines = normalizeLines(raw.lines)
      const edit: HashlineEdit = { op: "append", lines, pos: raw.pos }
      if (raw.pos) validateRef(raw.pos, refPattern)
      return edit
    }
    if (raw.op === "prepend") {
      const lines = normalizeLines(raw.lines)
      const edit: HashlineEdit = { op: "prepend", lines, pos: raw.pos }
      if (raw.pos) validateRef(raw.pos, refPattern)
      return edit
    }
    if (raw.op === "replace_text") {
      if (!raw.oldText) throw new Error("replace_text requires oldText")
      if (!raw.newText) throw new Error("replace_text requires newText")
      return { op: "replace_text", oldText: raw.oldText, newText: raw.newText }
    }
    throw new Error(`Unknown op: ${raw.op}`)
  })
}

function normalizeLines(lines: string | string[] | null | undefined): string | string[] {
  if (lines === null || lines === undefined) return []
  if (typeof lines === "string") return lines
  return lines
}

function validateRef(ref: string, pattern: RegExp): void {
  if (!ref.match(pattern)) {
    throw new Error(
      `Invalid LINE#ID format: "${ref}". Expected format: "LINE#ID" (e.g., "42#ZP")`,
    )
  }
}