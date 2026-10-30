import { HashlineEdit } from "./types";
export interface DedupeResult {
    edits: HashlineEdit[];
    deduplicatedEdits: number;
}
export declare function dedupeEdits(edits: HashlineEdit[]): DedupeResult;
//# sourceMappingURL=edit-deduplication.d.ts.map