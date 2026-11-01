export declare function applySetLine(lines: string[], posRef: string, newLines: string | string[], _options?: {
    skipValidation?: boolean;
    hashLength?: number;
}): string[];
export declare function applyReplaceLines(lines: string[], posRef: string, endRef: string, newLines: string | string[], _options?: {
    skipValidation?: boolean;
    hashLength?: number;
}): string[];
export declare function applyInsertAfter(lines: string[], posRef: string, newLines: string | string[], _options?: {
    skipValidation?: boolean;
    hashLength?: number;
}): string[];
export declare function applyInsertBefore(lines: string[], posRef: string, newLines: string | string[], _options?: {
    skipValidation?: boolean;
    hashLength?: number;
}): string[];
export declare function applyAppend(lines: string[], newLines: string | string[]): string[];
export declare function applyPrepend(lines: string[], newLines: string | string[]): string[];
export declare function applyReplaceText(lines: string[], oldText: string, newText: string): string[];
//# sourceMappingURL=edit-operation-primitives.d.ts.map