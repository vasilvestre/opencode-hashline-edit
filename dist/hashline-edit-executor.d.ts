/**
 * Hashline edit tool executor - uses Node.js fs for file operations
 */
import type { RawHashlineEdit } from "./types";
export interface ToolContext {
    sessionID: string;
    messageID: string;
    signal: AbortSignal;
    progress: (update: Record<string, any>) => Promise<void>;
    metadata?: (value: unknown) => void;
}
interface HashlineEditArgs {
    filePath: string;
    edits: RawHashlineEdit[];
    delete?: boolean;
    rename?: string;
    hashLength?: number;
}
interface PluginContextWithClient {
    client?: {
        api: {
            post: (path: string, data: unknown) => Promise<unknown>;
        };
    };
}
export declare function executeHashlineEditTool(args: HashlineEditArgs, toolContext: ToolContext, _pluginContext: unknown, pluginCtx?: PluginContextWithClient): Promise<string>;
export {};
//# sourceMappingURL=hashline-edit-executor.d.ts.map