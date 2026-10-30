/**
 * Validation utilities for hashline edits
 */
export declare const NIBBLE_STR = "ZPMQVRWSNKTXJBYH";
export declare const HASHLINE_DICT: string[];
export declare const HASHLINE_REF_PATTERN: RegExp;
export declare const HASHLINE_OUTPUT_PATTERN: RegExp;
export declare function validateLineRefs(lines: string[], refs: Map<string, {
    line: number;
    hash: string;
}>): void;
export declare function computeLineHash(content: string): string;
export declare function parseLineRef(ref: string): {
    line: number;
    hash: string;
} | null;
export declare function formatLineRef(line: number, hash: string): string;
export { HashlineMismatchError } from "./types";
//# sourceMappingURL=validation.d.ts.map