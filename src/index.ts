/**
 * OpenCode Hashline Edit Plugin
 * 
 * Provides the `hashline_edit` tool for safe, hash-validated line-based editing.
 * Uses LINE#ID format: line number + 2-char content hash (e.g., "42#ZP")
 */

import { tool, type ToolDefinition, type PluginContext } from "./opencode-types"
import { executeHashlineEditTool } from "./hashline-edit-executor"
import { HASHLINE_EDIT_DESCRIPTION } from "./tool-description"

interface HashlineEditArgs {
  filePath: string
  edits: Array<{
    op: "replace" | "append" | "prepend" | "replace_text"
    pos?: string
    end?: string
    lines?: string | string[] | null
    oldText?: string
    newText?: string
  }>
  delete?: boolean
  rename?: string
  hashLength?: number
}

export function createHashlineEditTool(pluginCtx?: PluginContext): ToolDefinition {
  return tool.tool({
    description: HASHLINE_EDIT_DESCRIPTION,
    args: {
      filePath: tool.schema.string().describe("Absolute path to the file to edit"),
      delete: tool.schema.boolean().optional().describe("Delete file instead of editing"),
      rename: tool.schema.string().optional().describe("Rename output file path after edits"),
      hashLength: tool.schema.number().optional().describe("Hash length 2-4 (default: 2)"),
      edits: tool.schema
        .array(
          tool.schema.object({
            op: tool.schema
              .union([
                tool.schema.literal("replace"),
                tool.schema.literal("append"),
                tool.schema.literal("prepend"),
                tool.schema.literal("replace_text"),
              ])
              .describe("Hashline edit operation mode"),
            pos: tool.schema.string().optional().describe("Primary anchor in LINE#ID format (e.g., '42#ZP')"),
            end: tool.schema.string().optional().describe("Range end anchor in LINE#ID format (e.g., '45#WS')"),
            lines: tool.schema
              .union([
                tool.schema.array(tool.schema.string()),
                tool.schema.string(),
              ])
              .optional()
              .describe("Replacement or inserted lines (for replace/append/prepend)"),
            oldText: tool.schema.string().optional().describe("Exact text to find (for replace_text)"),
            newText: tool.schema.string().optional().describe("Replacement text (for replace_text)"),
          })
        )
        .describe("Array of edit operations to apply (empty when delete=true)"),
    },
    execute: async (args: HashlineEditArgs, context) => {
      return executeHashlineEditTool(args, context, pluginCtx)
    },
  })
}

// Re-export types for consumers
export type { HashlineEditArgs } from "./types"
export type { RawHashlineEdit } from "./types"
export type { HashlineEdit } from "./types"