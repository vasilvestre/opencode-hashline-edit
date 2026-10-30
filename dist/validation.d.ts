/**
 * Validation utilities for hashline edits
 */
export { HashlineMismatchError, NoopLoopError } from "./types";
export declare function computeLineHash(content: string, hashLength?: number): string;
export declare function computeContextHash(lines: string[], lineIndex: number, hashLength?: number): string;
export declare const HASHLINE_REF_PATTERN: any;
export declare const HASHLINE_OUTPUT_PATTERN: any;
export declare function getRefPattern(hashLength: number): RegExp;
export declare function getOutputPattern(hashLength: number): RegExp;
export declare function validateLineRefs(lines: string[], refs: Map<string, {
    line: number;
    hash: string;
}>, hashLength?: number): void;
export declare function parseLineRef(ref: string, hashLength?: number): {
    line: number;
    hash: string;
} | null;
export declare function formatLineRef(line: number, hash: string): string;
export declare function checkNoopLoop(filePath: string): void;
export declare function resetNoopLoop(filePath: string): void;
export declare function incrementNoopLoop(filePath: string): void;
//# sourceMappingURL=validation.d.ts.map