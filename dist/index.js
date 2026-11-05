/**
 * OpenCode Hashline Edit Plugin
 *
 * Provides the `hashline_edit` tool for safe, hash-validated line-based editing.
 * Uses LINE#ID format: line number + 2-char content hash (e.g., "42#ZP")
 */
import { readFile } from "node:fs/promises";
import { Plugin } from "@opencode/plugin";
import { executeHashlineEditTool } from "./hashline-edit-executor.js";
import { HASHLINE_EDIT_DESCRIPTION } from "./tool-description.js";
import { tagReadContent } from "./read-anchors.js";
import { DEFAULT_CONFIG } from "./constants.js";
const TOOL_NAME = "hashline_edit";
export default Plugin.define({
    id: "hashline-edit",
    async setup(ctx) {
        const registration = await ctx.tool.transform((editor) => {
            editor.add({
                name: TOOL_NAME,
                description: HASHLINE_EDIT_DESCRIPTION,
                input: {
                    type: "object",
                    properties: {
                        filePath: {
                            type: "string",
                            description: "Absolute path to the file to edit",
                        },
                        delete: {
                            type: "boolean",
                            description: "Delete file instead of editing",
                        },
                        rename: {
                            type: "string",
                            description: "Rename output file path after edits",
                        },
                        hashLength: {
                            type: "number",
                            description: "Hash length 2-4 (default: 2)",
                            minimum: 2,
                            maximum: 4,
                        },
                        edits: {
                            type: "array",
                            description: "Array of edit operations to apply (empty when delete=true)",
                            items: {
                                type: "object",
                                properties: {
                                    op: {
                                        type: "string",
                                        enum: ["replace", "append", "prepend", "replace_text"],
                                        description: "Hashline edit operation mode",
                                    },
                                    pos: {
                                        type: "string",
                                        description: "Primary anchor in LINE#ID format (e.g., '42#ZP')",
                                    },
                                    end: {
                                        type: "string",
                                        description: "Range end anchor in LINE#ID format (e.g., '45#WS')",
                                    },
                                    lines: {
                                        type: ["array", "string"],
                                        description: "Replacement or inserted lines (for replace/append/prepend)",
                                        items: { type: "string" },
                                    },
                                    oldText: {
                                        type: "string",
                                        description: "Exact text to find (for replace_text)",
                                    },
                                    newText: {
                                        type: "string",
                                        description: "Replacement text (for replace_text)",
                                    },
                                },
                                required: ["op"],
                            },
                        },
                    },
                    required: ["filePath"],
                },
                execute: async (input, toolContext) => {
                    const result = await executeHashlineEditTool(input, toolContext, ctx);
                    return { content: result };
                },
            });
            // Missing IDs are ignored by update(), so a built-in tool may never be
            // visible here. The hook below is the documented path for built-ins; keep
            // both so anchors appear whichever registry the runtime exposes.
            editor.update("read", (tool) => {
                const execute = tool.execute;
                tool.execute = async (input, context) => {
                    const result = await execute(input, context);
                    return withAnchors(result, input);
                };
            });
        });
        const readHook = await ctx.tool.hook("execute.after", async (event) => {
            if (event.tool !== "read" || event.status !== "completed")
                return;
            const tagged = await withAnchors(event.result, event.input);
            if (tagged === event.result || typeof tagged.content !== "string")
                return;
            try {
                // The result object is ours in practice; a frozen one degrades to the
                // untagged output instead of failing the read.
                ;
                event.result.content = tagged.content;
            }
            catch {
                return;
            }
        });
        return async () => {
            await registration.dispose();
            await readHook.dispose();
        };
    },
});
async function withAnchors(result, input) {
    if (typeof result.content !== "string")
        return result;
    const filePath = readPathOf(input);
    if (!filePath)
        return result;
    let raw;
    try {
        raw = await readFile(filePath, "utf-8");
    }
    catch {
        return result;
    }
    const content = tagReadContent(result.content, raw, DEFAULT_CONFIG.hashLength);
    return content === result.content ? result : { ...result, content };
}
function readPathOf(input) {
    if (typeof input !== "object" || input === null)
        return undefined;
    const value = input;
    if (typeof value.filePath === "string")
        return value.filePath;
    if (typeof value.path === "string")
        return value.path;
    return undefined;
}
//# sourceMappingURL=index.js.map