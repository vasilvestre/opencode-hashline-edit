/**
 * File text canonicalization - normalizes line endings and extracts hashline tags
 */
export interface CanonicalEnvelope {
    content: string;
    lineHashes: Map<number, string>;
}
export declare function canonicalizeFileText(rawContent: string, hashLength?: number): CanonicalEnvelope;
export declare function restoreFileText(canonicalContent: string): string;
//# sourceMappingURL=file-text-canonicalization.d.ts.map