/**
 * Hashline edit tool executor - uses OpenCode v2 native APIs
 */

import type { ToolContext, PluginContext, FormatterClient } from "./opencode-types"
import { applyHashlineEditsWithReport } from "./edit-operations"
import { countLineDiffs, generateUnifiedDiff } from "./diff-utils"
import { canonicalizeFileText, restoreFileText } from "./file-text-canonicalization"
import { normalizeHashlineEdits } from "./normalize-edits"
import type { RawHashlineEdit, HashlineEdit } from "./types"
import { HashlineMismatchError, NoopLoopError, checkNoopLoop, resetNoopLoop } from "./validation"
import { runFormattersForFile } from "./formatter-trigger"
import { DEFAULT_CONFIG } from "./constants"

interface HashlineEditArgs {
  filePath: string
  edits: RawHashlineEdit[]
  delete?: boolean
  rename?: string
  hashLength?: number
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
  freshAnchors?: Array<{ line: number; hash: string; content: string }>,
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
      freshAnchors: freshAnchors?.map((a) => `${a.line}#${a.hash}|${a.content}`),
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

function formatFreshAnchors(anchors: Array<{ line: number; hash: string; content: string }>): string {
  if (!anchors || anchors.length === 0) return ""
  const lines = anchors.map((a) => `${a.line}#${a.hash}|${a.content}`)
  return `\n--- Fresh Anchors ---\n${lines.join("\n")}`
}

export async function executeHashlineEditTool(
  args: HashlineEditArgs,
  context: ToolContext,
  pluginCtx?: PluginContextWithClient,
): Promise<string> {
  try {
    const metadataContext = context as ToolContextWithMetadata
    const filePath = args.filePath
    const { delete: deleteMode, rename, hashLength = DEFAULT_CONFIG.hashLength } = args

    if (deleteMode && rename) {
      return "Error: delete and rename cannot be used together"
    }
    if (deleteMode && args.edits.length > 0) {
      return "Error: delete mode requires edits to be an empty array"
    }

    if (!deleteMode && (!args.edits || !Array.isArray(args.edits) || args.edits.length === 0)) {
      return "Error: edits parameter must be a non-empty array"
    }

    const edits = deleteMode ? [] : normalizeHashlineEdits(args.edits, hashLength)

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

    const oldEnvelope = canonicalizeFileText(rawOldContent, hashLength)
    const applyResult = applyHashlineEditsWithReport(oldEnvelope.content, edits, hashLength)
    const canonicalNewContent = applyResult.content

    // Noop loop guard
    if (canonicalNewContent === oldEnvelope.content && !rename) {
      try {
        // This will throw NoopLoopError if 3 consecutive no-ops
        checkNoopLoop(filePath)
      } catch (e: unknown) {
        if (e instanceof NoopLoopError) {
          return `Error: ${e.message}`
        }
        throw e
      }
      let diagnostic = `No changes made to ${filePath}. The edits produced identical content.`
      if (applyResult.noopEdits > 0) {
        diagnostic += ` No-op edits: ${applyResult.noopEdits}. Re-read the file and provide content that differs from current lines.`
      }
      return `Error: ${diagnostic}`
    }

    // Successful edit - reset noop loop counter
    resetNoopLoop(filePath)

    const writeContent = restoreFileText(canonicalNewContent, oldEnvelope, hashLength)

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
          const formattedEnvelope = canonicalizeFileText(formattedContent, hashLength)
          const formattedMeta = buildSuccessMeta(
            filePath,
            oldEnvelope.content,
            formattedEnvelope.content,
            applyResult.noopEdits,
            applyResult.deduplicatedEdits,
            applyResult.freshAnchors,
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
          return `Updated ${filePath} (formatted)${formatFreshAnchors(applyResult.freshAnchors ?? [])}`
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
      applyResult.freshAnchors,
    )

    await publishToolMetadata(metadataContext, meta)

    if (rename && rename !== filePath) {
      return `Moved ${filePath} to ${rename}`
    }

    return `Updated ${effectivePath}${formatFreshAnchors(applyResult.freshAnchors ?? [])}`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof HashlineMismatchError) {
      return `Error: hash mismatch - ${message}\nTip: reuse LINE#ID entries from the latest read/edit output, or batch related edits in one call.`
    }
    if (error instanceof NoopLoopError) {
      return `Error: ${message}`
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