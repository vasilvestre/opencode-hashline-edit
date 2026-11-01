/**
 * Formatter trigger - runs formatters on edited files via OpenCode API
 */
export interface FormatterClient {
    api: {
        post: (path: string, data: unknown) => Promise<unknown>;
    };
}
export declare function runFormattersForFile(client: FormatterClient, projectDir: string, filePath: string): Promise<void>;
//# sourceMappingURL=formatter-trigger.d.ts.map