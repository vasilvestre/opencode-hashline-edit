/**
 * Hashline edit tool executor - uses Node.js fs for file operations
 */

import { applyHashlineEditsWithReport } from "./edit-operations.js"
import { countLineDiffs, generateUnifiedDiff } from "./diff-utils.js"
import { canonicalizeFileText, restoreFileText } from "./file-text-canonicalization.js"
import { normalizeHashlineEdits } from "./normalize-edits.js"
import type { RawHashlineEdit, HashlineEdit } from "./types.js"
import { HashlineMismatchError, NoopLoopError, checkNoopLoop, resetNoopLoop } from "./validation.js"
import { runFormattersForFile } from "./formatter-trigger.js"
import { DEFAULT_CONFIG } from "./constants.js"
import { readFile, writeFile, unlink, rename as fsRename, access, constants } from "fs/promises"
import { dirname } from "path"
import { fileURLToPath } from "url"

export interface ToolContext {
  sessionID: string
  messageID: string
  signal: AbortSignal
  progress: (update: Record<string, any>) => Promise<void>
  metadata?: (value: unknown) => void
}

interface HashlineEditArgs {
  filePath: string
  edits: RawHashlineEdit[]
  delete?: boolean
  rename?: string
  hashLength?: number
}

interface PluginContextWithClient {
  client?: {
    api: {
      post: (path: string, data: unknown) => Promise<unknown>
    }
  }
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

async function readFileSafe(path: string): Promise<{ exists: boolean; content: string }> {
  try {
    const content = await readFile(path, "utf-8")
    return { exists: true, content }
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return { exists: false, content: "" }
    }
    throw e
  }
}

async function writeFileSafe(path: string, content: string): Promise<void> {
  // Ensure directory exists
  const { mkdir } = await import("fs/promises")
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, "utf-8")
}

async function deleteFileSafe(path: string): Promise<void> {
  await unlink(path)
}

async function renameFileSafe(from: string, to: string): Promise<void> {
  const { mkdir } = await import("fs/promises")
  await mkdir(dirname(to), { recursive: true })
  await fsRename(from, to)
}

// VERSION MARKER: 2026-10-30-v2-node-fs
export async function executeHashlineEditTool(
  args: HashlineEditArgs,
  toolContext: ToolContext,
  _pluginContext: unknown,
  pluginCtx?: PluginContextWithClient,
): Promise<string> {
  try {
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

    // Read file using Node.js fs
    const { exists, content: rawOldContent } = await readFileSafe(filePath)

    if (!exists && !deleteMode && !canCreateFromMissingFile(edits)) {
      return `Error: File not found: ${filePath}`
    }

    if (deleteMode) {
      if (!exists) return `Error: File not found: ${filePath}`
      await deleteFileSafe(filePath)
      return `Successfully deleted ${filePath}`
    }

    const oldEnvelope = canonicalizeFileText(rawOldContent, hashLength)
    const applyResult = applyHashlineEditsWithReport(oldEnvelope.content, edits, hashLength)
    const canonicalNewContent = applyResult.content

    // Noop loop guard
    if (canonicalNewContent === oldEnvelope.content && !rename) {
      try {
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

    // Write file using Node.js fs
    await writeFileSafe(filePath, writeContent)

    // Run formatters if client available
    if (pluginCtx?.client) {
      await runFormattersForFile(pluginCtx.client, filePath, filePath)

      // Re-read formatted content
      const { content: formattedContent } = await readFileSafe(filePath)
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
        await publishToolMetadata(toolContext, formattedMeta)

        if (rename && rename !== filePath) {
          await writeFileSafe(rename, formattedContent)
          await deleteFileSafe(filePath)
          return `Moved ${filePath} to ${rename}`
        }
        return `Updated ${filePath} (formatted)${formatFreshAnchors(applyResult.freshAnchors ?? [])}`
      }
    }

    if (rename && rename !== filePath) {
      await writeFileSafe(rename, writeContent)
      await deleteFileSafe(filePath)
      return `Moved ${filePath} to ${rename}`
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

    await publishToolMetadata(toolContext, meta)

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
  context: ToolContext,
  meta: unknown,
): Promise<void> {
  if (context.metadata) {
    context.metadata(meta)
  }
}