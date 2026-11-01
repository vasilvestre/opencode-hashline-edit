/**
 * File text canonicalization - normalizes line endings and extracts hashline tags
 */
import { computeContextHash, getOutputPattern } from "./validation.js";
export function canonicalizeFileText(rawContent, hashLength = 2) {
    // Normalize line endings
    const content = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = content.split("\n");
    const lineHashes = new Map();
    const canonicalLines = [];
    const outputPattern = getOutputPattern(hashLength);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(outputPattern);
        if (match) {
            // Line has hashline tag - strip it
            canonicalLines.push(match[3]);
            lineHashes.set(i + 1, match[2]);
        }
        else {
            canonicalLines.push(line);
            lineHashes.set(i + 1, computeContextHash(canonicalLines, canonicalLines.length - 1, hashLength));
        }
    }
    return {
        content: canonicalLines.join("\n"),
        lineHashes,
    };
}
// Tags belong to the tool output only: writing them back corrupts the file.
export function restoreFileText(canonicalContent) {
    return canonicalContent;
}
//# sourceMappingURL=file-text-canonicalization.js.map