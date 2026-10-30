/**
 * OpenCode Hashline Edit Plugin
 *
 * Provides the `hashline_edit` tool for safe, hash-validated line-based editing.
 * Uses LINE#ID format: line number + 2-char content hash (e.g., "42#ZP")
 */
import { type ToolDefinition, type PluginContext } from "./opencode-types";
export declare function createHashlineEditTool(pluginCtx?: PluginContext): ToolDefinition;
export type { HashlineEditArgs } from "./types";
export type { RawHashlineEdit } from "./types";
export type { HashlineEdit } from "./types";
//# sourceMappingURL=index.d.ts.map