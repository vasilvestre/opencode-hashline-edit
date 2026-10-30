/**
 * Hashline edit types
 * Using explicit discriminated union with `op` as discriminant
 */

export interface ReplaceEdit {
  op: "replace"
  pos: string
  end?: string
  lines: string | string[]
}

export interface AppendEdit {
  op: "append"
  pos?: string
  lines: string | string[]
}

export interface PrependEdit {
  op: "prepend"
  pos?: string
  lines: string | string[]
}

export type HashlineEdit = ReplaceEdit | AppendEdit | PrependEdit

export interface RawHashlineEdit {
  op: "replace" | "append" | "prepend"
  pos?: string
  end?: string
  lines: string | string[] | null
}

export interface HashlineApplyReport {
  content: string
  noopEdits: number
  deduplicatedEdits: number
}

export class HashlineMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HashlineMismatchError"
  }
}

// Type guards for discriminated union
export function isReplaceEdit(edit: HashlineEdit): edit is ReplaceEdit {
  return edit.op === "replace"
}

export function isAppendEdit(edit: HashlineEdit): edit is AppendEdit {
  return edit.op === "append"
}

export function isPrependEdit(edit: HashlineEdit): edit is PrependEdit {
  return edit.op === "prepend"
}

export interface HashlineEditArgs {
  filePath: string
  edits: RawHashlineEdit[]
  delete?: boolean
  rename?: string
}