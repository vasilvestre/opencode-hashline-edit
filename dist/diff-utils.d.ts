/**
 * Diff utilities - generates unified diff and counts line changes
 */
export declare function countLineDiffs(before: string, after: string): {
    additions: number;
    deletions: number;
};
export declare function generateUnifiedDiff(before: string, after: string, filePath: string): string;
//# sourceMappingURL=diff-utils.d.ts.map