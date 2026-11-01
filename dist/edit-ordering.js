import { parseLineRef } from "./validation.js";
export function getEditLineNumber(edit) {
    if (edit.op === "replace" && edit.pos) {
        const parsed = parseLineRef(edit.pos);
        if (parsed)
            return parsed.line;
    }
    if (edit.op === "append" && edit.pos) {
        const parsed = parseLineRef(edit.pos);
        if (parsed)
            return parsed.line;
    }
    if (edit.op === "prepend" && edit.pos) {
        const parsed = parseLineRef(edit.pos);
        if (parsed)
            return parsed.line;
    }
    // replace_text doesn't use line anchors, so it goes last
    if (edit.op === "replace_text") {
        return -1;
    }
    return Infinity;
}
export function collectLineRefs(edits) {
    const refs = new Map();
    for (const edit of edits) {
        if (edit.op === "replace") {
            if (edit.pos) {
                const parsed = parseLineRef(edit.pos);
                if (parsed)
                    refs.set(edit.pos, parsed);
            }
            if (edit.end) {
                const parsed = parseLineRef(edit.end);
                if (parsed)
                    refs.set(edit.end, parsed);
            }
        }
        if (edit.op === "append" && edit.pos) {
            const parsed = parseLineRef(edit.pos);
            if (parsed)
                refs.set(edit.pos, parsed);
        }
        if (edit.op === "prepend" && edit.pos) {
            const parsed = parseLineRef(edit.pos);
            if (parsed)
                refs.set(edit.pos, parsed);
        }
    }
    return refs;
}
export function detectOverlappingRanges(edits) {
    const ranges = [];
    for (const edit of edits) {
        if (edit.op !== "replace")
            continue;
        const start = edit.pos ? parseLineRef(edit.pos)?.line ?? 0 : 0;
        const end = edit.end ? parseLineRef(edit.end)?.line ?? start : start;
        if (start > 0)
            ranges.push({ start, end, edit });
    }
    ranges.sort((a, b) => a.start - b.start);
    for (let i = 0; i < ranges.length - 1; i++) {
        if (ranges[i].end >= ranges[i + 1].start) {
            const editA = ranges[i].edit;
            const editB = ranges[i + 1].edit;
            // TypeScript narrowing: editA and editB are ReplaceEdit here
            const endA = editA.op === "replace" ? editA.end : "";
            const endB = editB.op === "replace" ? editB.end : "";
            const posA = editA.op === "replace" ? editA.pos : "";
            const posB = editB.op === "replace" ? editB.pos : "";
            return `Overlapping edits: ${formatRef(posA)}–${formatRef(endA)} overlaps ${formatRef(posB)}–${formatRef(endB)}`;
        }
    }
    return null;
}
function formatRef(ref) {
    return ref ?? "start/end";
}
//# sourceMappingURL=edit-ordering.js.map