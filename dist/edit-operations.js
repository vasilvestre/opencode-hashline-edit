import { dedupeEdits } from "./edit-deduplication";
import { collectLineRefs, detectOverlappingRanges, getEditLineNumber } from "./edit-ordering";
import { applyAppend, applyInsertAfter, applyInsertBefore, applyPrepend, applyReplaceLines, applyReplaceText, applySetLine, } from "./edit-operation-primitives";
import { validateLineRefs, computeContextHash } from "./validation";
function arraysEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
function generateFreshAnchors(lines, hashLength) {
    return lines.map((line, index) => ({
        line: index + 1,
        hash: computeContextHash(lines, index, hashLength),
        content: line,
    }));
}
export function applyHashlineEditsWithReport(content, edits, hashLength = 2) {
    if (edits.length === 0) {
        return { content, noopEdits: 0, deduplicatedEdits: 0, freshAnchors: generateFreshAnchors(content.split("\n"), hashLength) };
    }
    const dedupeResult = dedupeEdits(edits);
    const EDIT_PRECEDENCE = { replace: 0, append: 1, prepend: 2, replace_text: 3 };
    const sortedEdits = [...dedupeResult.edits].sort((a, b) => {
        const lineA = getEditLineNumber(a);
        const lineB = getEditLineNumber(b);
        if (lineB !== lineA)
            return lineB - lineA;
        return (EDIT_PRECEDENCE[a.op] ?? 3) - (EDIT_PRECEDENCE[b.op] ?? 3);
    });
    let noopEdits = 0;
    let lines = content.length === 0 ? [] : content.split("\n");
    // Collect all refs for validation (only for anchor-based ops)
    const refs = collectLineRefs(sortedEdits);
    if (refs.size > 0) {
        validateLineRefs(lines, refs, hashLength);
    }
    const overlapError = detectOverlappingRanges(sortedEdits);
    if (overlapError)
        throw new Error(overlapError);
    for (const edit of sortedEdits) {
        switch (edit.op) {
            case "replace": {
                const next = edit.end
                    ? applyReplaceLines(lines, edit.pos, edit.end, edit.lines, { skipValidation: true, hashLength })
                    : applySetLine(lines, edit.pos, edit.lines, { skipValidation: true, hashLength });
                if (arraysEqual(next, lines)) {
                    noopEdits++;
                    break;
                }
                lines = next;
                break;
            }
            case "append": {
                const next = edit.pos
                    ? applyInsertAfter(lines, edit.pos, edit.lines, { skipValidation: true, hashLength })
                    : applyAppend(lines, edit.lines);
                if (arraysEqual(next, lines)) {
                    noopEdits++;
                    break;
                }
                lines = next;
                break;
            }
            case "prepend": {
                const next = edit.pos
                    ? applyInsertBefore(lines, edit.pos, edit.lines, { skipValidation: true, hashLength })
                    : applyPrepend(lines, edit.lines);
                if (arraysEqual(next, lines)) {
                    noopEdits++;
                    break;
                }
                lines = next;
                break;
            }
            case "replace_text": {
                const next = applyReplaceText(lines, edit.oldText, edit.newText);
                if (arraysEqual(next, lines)) {
                    noopEdits++;
                    break;
                }
                lines = next;
                break;
            }
        }
    }
    const freshAnchors = generateFreshAnchors(lines, hashLength);
    return {
        content: lines.join("\n"),
        noopEdits,
        deduplicatedEdits: dedupeResult.deduplicatedEdits,
        freshAnchors,
    };
}
export function applyHashlineEdits(content, edits, hashLength = 2) {
    return applyHashlineEditsWithReport(content, edits, hashLength).content;
}
//# sourceMappingURL=edit-operations.js.map