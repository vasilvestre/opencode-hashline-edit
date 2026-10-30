/**
 * Hashline edit tool executor - uses OpenCode v2 native APIs
 */
import type { RawHashlineEdit } from "./types";
export interface ToolContext {
    sessionID: string;
    messageID: string;
    signal: AbortSignal;
    progress: (update: Record<string, any>) => Promise<void>;
    metadata?: (value: unknown) => void;
    api?: {
        get: (path: string) => Promise<Response>;
        post: (path: string, options: {
            body: string;
        }) => Promise<Response>;
        delete: (path: string, options: {
            body: string;
        }) => Promise<Response>;
    };
}
interface PluginApi {
    get: (path: string) => Promise<Response>;
    post: (path: string, options: {
        body: string;
    }) => Promise<Response>;
    delete: (path: string, options: {
        body: string;
    }) => Promise<Response>;
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
export declare function executeHashlineEditTool(args: HashlineEditArgs, toolContext: ToolContext, pluginContext: PluginApi, pluginCtx?: PluginContextWithClient): Promise<string>;
export {};
//# sourceMappingURL=hashline-edit-executor.d.ts.map