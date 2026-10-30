import { HashlineEdit } from "./types";
export declare function getEditLineNumber(edit: HashlineEdit): number;
export declare function collectLineRefs(edits: HashlineEdit[]): Map<string, {
    line: number;
    hash: string;
}>;
export declare function detectOverlappingRanges(edits: HashlineEdit[]): string | null;
//# sourceMappingURL=edit-ordering.d.ts.map