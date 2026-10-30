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
export type HashlineEdit = ReplaceEdit | AppendEdit | PrependEdit;
export interface RawHashlineEdit {
    op: "replace" | "append" | "prepend";
    pos?: string;
    end?: string;
    lines: string | string[] | null;
}
export interface HashlineApplyReport {
    content: string;
    noopEdits: number;
    deduplicatedEdits: number;
}
export declare class HashlineMismatchError extends Error {
    constructor(message: string);
}
export declare function isReplaceEdit(edit: HashlineEdit): edit is ReplaceEdit;
export declare function isAppendEdit(edit: HashlineEdit): edit is AppendEdit;
export declare function isPrependEdit(edit: HashlineEdit): edit is PrependEdit;
export interface HashlineEditArgs {
    filePath: string;
    edits: RawHashlineEdit[];
    delete?: boolean;
    rename?: string;
}
//# sourceMappingURL=types.d.ts.map