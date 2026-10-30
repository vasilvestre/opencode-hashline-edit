/**
 * Hashline edit types
 * Using explicit discriminated union with `op` as discriminant
 */
export interface ReplaceEdit {
    op: "replace";
    pos: string;
    end?: string;
    lines: string | string[];
}
export interface AppendEdit {
    op: "append";
    pos?: string;
    lines: string | string[];
}
export interface PrependEdit {
    op: "prepend";
    pos?: string;
    lines: string | string[];
}
export interface ReplaceTextEdit {
    op: "replace_text";
    oldText: string;
    newText: string;
}
export type HashlineEdit = ReplaceEdit | AppendEdit | PrependEdit | ReplaceTextEdit;
export interface RawHashlineEdit {
    op: "replace" | "append" | "prepend" | "replace_text";
    pos?: string;
    end?: string;
    lines?: string | string[] | null;
    oldText?: string;
    newText?: string;
}
export interface HashlineApplyReport {
    content: string;
    noopEdits: number;
    deduplicatedEdits: number;
    freshAnchors?: Array<{
        line: number;
        hash: string;
        content: string;
    }>;
}
export declare class HashlineMismatchError extends Error {
    constructor(message: string);
}
export declare class NoopLoopError extends Error {
    constructor(message: string);
}
export declare function isReplaceEdit(edit: HashlineEdit): edit is ReplaceEdit;
export declare function isAppendEdit(edit: HashlineEdit): edit is AppendEdit;
export declare function isPrependEdit(edit: HashlineEdit): edit is PrependEdit;
export declare function isReplaceTextEdit(edit: HashlineEdit): edit is ReplaceTextEdit;
export interface HashlineEditArgs {
    filePath: string;
    edits: RawHashlineEdit[];
    delete?: boolean;
    rename?: string;
}
//# sourceMappingURL=types.d.ts.map