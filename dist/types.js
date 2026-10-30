/**
 * Hashline edit types
 * Using explicit discriminated union with `op` as discriminant
 */
export class HashlineMismatchError extends Error {
    constructor(message) {
        super(message);
        this.name = "HashlineMismatchError";
    }
}
export class NoopLoopError extends Error {
    constructor(message) {
        super(message);
        this.name = "NoopLoopError";
    }
}
// Type guards for discriminated union
export function isReplaceEdit(edit) {
    return edit.op === "replace";
}
export function isAppendEdit(edit) {
    return edit.op === "append";
}
export function isPrependEdit(edit) {
    return edit.op === "prepend";
}
export function isReplaceTextEdit(edit) {
    return edit.op === "replace_text";
}
//# sourceMappingURL=types.js.map