/**
 * Formatter trigger - runs formatters on edited files via OpenCode API
 */

export interface FormatterClient {
  api: {
    post: (path: string, data: unknown) => Promise<unknown>
  }
}

export async function runFormattersForFile(
  client: FormatterClient,
  projectDir: string,
  filePath: string,
): Promise<void> {
  try {
    await client.api.post("/api/experimental/formatter/run", {
      directory: projectDir,
      files: [filePath],
    })
  } catch {
    // Formatter failed - ignore, file is still valid
  }
}