import type { HashlineEdit } from "./types.js";
export interface DedupeResult {
    edits: HashlineEdit[];
    deduplicatedEdits: number;
}
export declare function dedupeEdits(edits: HashlineEdit[]): DedupeResult;
//# sourceMappingURL=edit-deduplication.d.ts.map