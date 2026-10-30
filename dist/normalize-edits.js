/**
 * Normalize raw hashline edits to internal format
 */
import { HASHLINE_REF_PATTERN } from "./validation";
export function normalizeHashlineEdits(rawEdits) {
    return rawEdits.map((raw) => {
        const lines = normalizeLines(raw.lines);
        if (raw.op === "replace") {
            const edit = { op: "replace", lines, pos: raw.pos ?? "", end: raw.end };
            if (raw.pos)
                validateRef(raw.pos);
            if (raw.end)
                validateRef(raw.end);
            return edit;
        }
        if (raw.op === "append") {
            const edit = { op: "append", lines, pos: raw.pos };
            if (raw.pos)
                validateRef(raw.pos);
            return edit;
        }
        if (raw.op === "prepend") {
            const edit = { op: "prepend", lines, pos: raw.pos };
            if (raw.pos)
                validateRef(raw.pos);
            return edit;
        }
        throw new Error(`Unknown op: ${raw.op}`);
    });
}
function normalizeLines(lines) {
    if (lines === null)
        return [];
    if (typeof lines === "string")
        return lines;
    return lines;
}
function validateRef(ref) {
    if (!ref.match(HASHLINE_REF_PATTERN)) {
        throw new Error(`Invalid LINE#ID format: "${ref}". Expected format: "LINE#ID" (e.g., "42#ZP")`);
    }
}
//# sourceMappingURL=normalize-edits.js.map