/**
 * Hashline edit tool executor - uses OpenCode v2 native APIs
 */

import type { ToolContext, PluginContext, FormatterClient } from "./opencode-types"
import { applyHashlineEditsWithReport } from "./edit-operations"
import { countLineDiffs, generateUnifiedDiff } from "./diff-utils"
import { canonicalizeFileText, restoreFileText } from "./file-text-canonicalization"
import { normalizeHashlineEdits } from "./normalize-edits"
import type { RawHashlineEdit, HashlineEdit } from "./types"
import { HashlineMismatchError } from "./validation"
import { runFormattersForFile } from "./formatter-trigger"

interface HashlineEditArgs {
  filePath: string
  edits: RawHashlineEdit[]
  delete?: boolean
  rename?: string
}

interface ToolContextWithMetadata extends ToolContext {
  metadata?: (value: unknown) => void
}

interface PluginContextWithClient {
  client?: FormatterClient
}

function canCreateFromMissingFile(edits: HashlineEdit[]): boolean {
  if (edits.length === 0) return false
  return edits.every(
    (edit) => (edit.op === "append" || edit.op === "prepend") && !edit.pos,
  )
}

function buildSuccessMeta(
  effectivePath: string,
  beforeContent: string,
  afterContent: string,
  noopEdits: number,
  deduplicatedEdits: number,
) {
  const unifiedDiff = generateUnifiedDiff(beforeContent, afterContent, effectivePath)
  const { additions, deletions } = countLineDiffs(beforeContent, afterContent)
  const beforeLines = beforeContent.split("\n")
  const afterLines = afterContent.split("\n")
  const maxLength = Math.max(beforeLines.length, afterLines.length)

  let firstChangedLine: number | undefined
  for (let index = 0; index < maxLength; index++) {
    if ((beforeLines[index] ?? "") !== (afterLines[index] ?? "")) {
      firstChangedLine = index + 1
      break
    }
  }

  return {
    title: effectivePath,
    metadata: {
      filePath: effectivePath,
      path: effectivePath,
      file: effectivePath,
      diff: unifiedDiff,
      noopEdits,
      deduplicatedEdits,
      firstChangedLine,
      filediff: {
        file: effectivePath,
        path: effectivePath,
        filePath: effectivePath,
        before: beforeContent,
        after: afterContent,
        additions,
        deletions,
      },
    },
  }
}

export async function executeHashlineEditTool(
  args: HashlineEditArgs,
  context: ToolContext,
  pluginCtx?: PluginContextWithClient,
): Promise<string> {
  try {
    const metadataContext = context as ToolContextWithMetadata
    const filePath = args.filePath
    const { delete: deleteMode, rename } = args

    if (deleteMode && rename) {
      return "Error: delete and rename cannot be used together"
    }
    if (deleteMode && args.edits.length > 0) {
      return "Error: delete mode requires edits to be an empty array"
    }

    if (!deleteMode && (!args.edits || !Array.isArray(args.edits) || args.edits.length === 0)) {
      return "Error: edits parameter must be a non-empty array"
    }

    const edits = deleteMode ? [] : normalizeHashlineEdits(args.edits)

    // Use OpenCode v2 filesystem API
    const readResponse = await context.api.get(`/api/fs/read/${encodeURIComponent(filePath)}`)
    const exists = readResponse.ok
    let rawOldContent = ""

    if (exists) {
      const data = await readResponse.json()
      rawOldContent = (data as { content?: string }).content ?? ""
    }

    if (!exists && !deleteMode && !canCreateFromMissingFile(edits)) {
      return `Error: File not found: ${filePath}`
    }

    if (deleteMode) {
      if (!exists) return `Error: File not found: ${filePath}`
      await context.api.delete(`/api/experimental/fs/write`, {
        body: JSON.stringify({ path: filePath, content: "", delete: true }),
      })
      return `Successfully deleted ${filePath}`
    }

    const oldEnvelope = canonicalizeFileText(rawOldContent)
    const applyResult = applyHashlineEditsWithReport(oldEnvelope.content, edits)
    const canonicalNewContent = applyResult.content

    if (canonicalNewContent === oldEnvelope.content && !rename) {
      let diagnostic = `No changes made to ${filePath}. The edits produced identical content.`
      if (applyResult.noopEdits > 0) {
        diagnostic += ` No-op edits: ${applyResult.noopEdits}. Re-read the file and provide content that differs from current lines.`
      }
      return `Error: ${diagnostic}`
    }

    const writeContent = restoreFileText(canonicalNewContent, oldEnvelope)

    // Write via OpenCode v2 experimental API
    await context.api.post("/api/experimental/fs/write", {
      body: JSON.stringify({ path: filePath, content: writeContent }),
    })

    // Run formatters if client available
    if (pluginCtx?.client) {
      await runFormattersForFile(pluginCtx.client, context.directory, filePath)

      // Re-read formatted content
      const formattedResponse = await context.api.get(
        `/api/fs/read/${encodeURIComponent(filePath)}`,
      )
      if (formattedResponse.ok) {
        const data = await formattedResponse.json()
        const formattedContent = (data as { content?: string }).content ?? ""
        if (formattedContent !== writeContent) {
          const formattedEnvelope = canonicalizeFileText(formattedContent)
          const formattedMeta = buildSuccessMeta(
            filePath,
            oldEnvelope.content,
            formattedEnvelope.content,
            applyResult.noopEdits,
            applyResult.deduplicatedEdits,
          )
          await publishToolMetadata(metadataContext, formattedMeta)

          if (rename && rename !== filePath) {
            await context.api.post("/api/experimental/fs/write", {
              body: JSON.stringify({ path: rename, content: formattedContent }),
            })
            await context.api.post("/api/experimental/fs/write", {
              body: JSON.stringify({ path: filePath, content: "", delete: true }),
            })
            return `Moved ${filePath} to ${rename}`
          }
          return `Updated ${filePath} (formatted)`
        }
      }
    }

    if (rename && rename !== filePath) {
      await context.api.post("/api/experimental/fs/write", {
        body: JSON.stringify({ path: rename, content: writeContent }),
      })
      await context.api.post("/api/experimental/fs/write", {
        body: JSON.stringify({ path: filePath, content: "", delete: true }),
      })
    }

    const effectivePath = rename && rename !== filePath ? rename : filePath
    const meta = buildSuccessMeta(
      effectivePath,
      oldEnvelope.content,
      canonicalNewContent,
      applyResult.noopEdits,
      applyResult.deduplicatedEdits,
    )

    await publishToolMetadata(metadataContext, meta)

    if (rename && rename !== filePath) {
      return `Moved ${filePath} to ${rename}`
    }

    return `Updated ${effectivePath}`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof HashlineMismatchError) {
      return `Error: hash mismatch - ${message}\nTip: reuse LINE#ID entries from the latest read/edit output, or batch related edits in one call.`
    }
    return `Error: ${message}`
  }
}

async function publishToolMetadata(
  context: ToolContextWithMetadata,
  meta: unknown,
): Promise<void> {
  if (context.metadata) {
    context.metadata(meta)
  }
}