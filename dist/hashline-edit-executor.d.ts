/**
 * Hashline edit tool executor - uses OpenCode v2 native APIs
 */
import type { ToolContext, FormatterClient } from "./opencode-types";
import type { RawHashlineEdit } from "./types";
interface HashlineEditArgs {
    filePath: string;
    edits: RawHashlineEdit[];
    delete?: boolean;
    rename?: string;
}
interface PluginContextWithClient {
    client?: FormatterClient;
}
export declare function executeHashlineEditTool(args: HashlineEditArgs, context: ToolContext, pluginCtx?: PluginContextWithClient): Promise<string>;
export {};
//# sourceMappingURL=hashline-edit-executor.d.ts.map