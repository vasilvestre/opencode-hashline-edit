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

export interface ReplaceTextEdit {
  op: "replace_text"
  oldText: string
  newText: string
}

export type HashlineEdit = ReplaceEdit | AppendEdit | PrependEdit | ReplaceTextEdit

export interface RawHashlineEdit {
  op: "replace" | "append" | "prepend" | "replace_text"
  pos?: string
  end?: string
  lines?: string | string[] | null
  oldText?: string
  newText?: string
}

export interface HashlineApplyReport {
  content: string
  noopEdits: number
  deduplicatedEdits: number
  freshAnchors?: Array<{ line: number; hash: string; content: string }>
}

export class HashlineMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HashlineMismatchError"
  }
}

export class NoopLoopError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NoopLoopError"
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

export function isReplaceTextEdit(edit: HashlineEdit): edit is ReplaceTextEdit {
  return edit.op === "replace_text"
}

export interface HashlineEditArgs {
  filePath: string
  edits: RawHashlineEdit[]
  delete?: boolean
  rename?: string
}