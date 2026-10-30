import type { HashlineEdit } from "./types.js"
import { isReplaceEdit, isAppendEdit, isPrependEdit, isReplaceTextEdit } from "./types.js"

export interface DedupeResult {
  edits: HashlineEdit[]
  deduplicatedEdits: number
}

export function dedupeEdits(edits: HashlineEdit[]): DedupeResult {
  const seen = new Map<string, HashlineEdit>()
  let deduplicatedEdits = 0

  for (const edit of edits) {
    const key = editKey(edit)
    if (seen.has(key)) {
      deduplicatedEdits++
    } else {
      seen.set(key, edit)
    }
  }

  return {
    edits: Array.from(seen.values()),
    deduplicatedEdits,
  }
}

function editKey(edit: HashlineEdit): string {
  const parts: string[] = [edit.op]

  if (isReplaceEdit(edit)) {
    if (edit.pos) parts.push("pos:" + edit.pos)
    if (edit.end) parts.push("end:" + edit.end)
  }
  if (isAppendEdit(edit) && edit.pos) parts.push("pos:" + edit.pos)
  if (isPrependEdit(edit) && edit.pos) parts.push("pos:" + edit.pos)

  if (isReplaceTextEdit(edit)) {
    parts.push("oldText:" + edit.oldText)
    parts.push("newText:" + edit.newText)
  } else {
    const lines = Array.isArray(edit.lines) ? edit.lines.join("\n") : edit.lines
    parts.push("lines:" + lines)
  }

  return parts.join("|")
}