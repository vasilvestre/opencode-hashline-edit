/**
 * File text canonicalization - normalizes line endings and extracts hashline tags
 */
export interface CanonicalEnvelope {
    content: string;
    lineHashes: Map<number, string>;
}
export declare function canonicalizeFileText(rawContent: string, hashLength?: number): CanonicalEnvelope;
//# sourceMappingURL=file-text-canonicalization.d.ts.map