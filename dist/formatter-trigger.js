/**
 * Formatter trigger - runs formatters on edited files via OpenCode API
 */
export async function runFormattersForFile(client, projectDir, filePath) {
    try {
        await client.api.post("/api/experimental/formatter/run", {
            directory: projectDir,
            files: [filePath],
        });
    }
    catch {
        // Formatter failed - ignore, file is still valid
    }
}
//# sourceMappingURL=formatter-trigger.js.map