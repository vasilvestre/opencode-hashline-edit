/**
 * Validation utilities for hashline edits
 */
import { HashlineMismatchError } from "./types";
export const NIBBLE_STR = "ZPMQVRWSNKTXJBYH";
export const HASHLINE_DICT = Array.from({ length: 256 }, (_, i) => {
    const high = i >>> 4;
    const low = i & 0x0f;
    return `${NIBBLE_STR[high]}${NIBBLE_STR[low]}`;
});
export const HASHLINE_REF_PATTERN = /^([0-9]+)#([ZPMQVRWSNKTXJBYH]{2})$/;
export const HASHLINE_OUTPUT_PATTERN = /^([0-9]+)#([ZPMQVRWSNKTXJBYH]{2})\|(.*)$/;
export function validateLineRefs(lines, refs) {
    for (const [ref, { line, hash }] of refs) {
        if (line < 1 || line > lines.length) {
            throw new HashlineMismatchError(`Line ${line} out of range (1-${lines.length}) for ref ${ref}`);
        }
        const actualHash = computeLineHash(lines[line - 1]);
        if (actualHash !== hash) {
            throw new HashlineMismatchError(`Hash mismatch at line ${line}: expected ${hash}, got ${actualHash}. ` +
                `File content may have changed. Re-read the file and use fresh LINE#ID tags.`);
        }
    }
}
export function computeLineHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
    }
    const high = (hash >>> 4) & 0x0f;
    const low = hash & 0x0f;
    return `${NIBBLE_STR[high & 0x0f]}${NIBBLE_STR[low & 0x0f]}`;
}
export function parseLineRef(ref) {
    const match = ref.match(HASHLINE_REF_PATTERN);
    if (!match)
        return null;
    return { line: parseInt(match[1], 10), hash: match[2] };
}
export function formatLineRef(line, hash) {
    return `${line}#${hash}`;
}
// Re-export for consumers
export { HashlineMismatchError } from "./types";
//# sourceMappingURL=validation.js.map