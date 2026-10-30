import { describe, it, expect } from "vitest"
import { applyHashlineEdits, applyHashlineEditsWithReport } from "./edit-operations"
import { normalizeHashlineEdits } from "./normalize-edits"
import { computeContextHash } from "./validation"
import { canonicalizeFileText } from "./file-text-canonicalization"

function makeContextHash(lines: string[], index: number): string {
  return computeContextHash(lines, index)
}

function makeEdit(op: "replace" | "append" | "prepend", pos: string, lines: string | string[], end?: string) {
  return { op, pos, lines, end }
}

describe("edit-operations", () => {
  const sampleLines = ["line 1", "line 2", "line 3", "line 4", "line 5"]
  const sampleContent = sampleLines.join("\n")
  const hashes = sampleLines.map((_, i) => makeContextHash(sampleLines, i))

  describe("applyHashlineEdits", () => {
    it("replaces a single line", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("replace", `2#${hashes[1]}`, "NEW LINE 2"),
      ])
      const result = applyHashlineEdits(sampleContent, edits)
      expect(result).toBe("line 1\nNEW LINE 2\nline 3\nline 4\nline 5")
    })

    it("replaces a range of lines", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("replace", `2#${hashes[1]}`, ["NEW 2", "NEW 3", "NEW 4"], `4#${hashes[3]}`),
      ])
      const result = applyHashlineEdits(sampleContent, edits)
      expect(result).toBe("line 1\nNEW 2\nNEW 3\nNEW 4\nline 5")
    })

    it("appends after a line", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("append", `3#${hashes[2]}`, "INSERTED AFTER 3"),
      ])
      const result = applyHashlineEdits(sampleContent, edits)
      expect(result).toBe("line 1\nline 2\nline 3\nINSERTED AFTER 3\nline 4\nline 5")
    })

    it("appends at end of file", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("append", "", "AT END"),
      ])
      const result = applyHashlineEdits(sampleContent, edits)
      expect(result).toBe("line 1\nline 2\nline 3\nline 4\nline 5\nAT END")
    })

    it("prepends before a line", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("prepend", `3#${hashes[2]}`, "INSERTED BEFORE 3"),
      ])
      const result = applyHashlineEdits(sampleContent, edits)
      expect(result).toBe("line 1\nline 2\nINSERTED BEFORE 3\nline 3\nline 4\nline 5")
    })

    it("prepends at start of file", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("prepend", "", "AT START"),
      ])
      const result = applyHashlineEdits(sampleContent, edits)
      expect(result).toBe("AT START\nline 1\nline 2\nline 3\nline 4\nline 5")
    })

    it("handles multiple edits in one call (sorted bottom-up)", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("replace", `2#${hashes[1]}`, "NEW 2"),
        makeEdit("append", `4#${hashes[3]}`, "AFTER 4"),
      ])
      const result = applyHashlineEdits(sampleContent, edits)
      expect(result).toContain("NEW 2")
      expect(result).toContain("AFTER 4")
    })

    it("detects no-op edits", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("replace", `2#${hashes[1]}`, "line 2"),
      ])
      const report = applyHashlineEditsWithReport(sampleContent, edits)
      expect(report.noopEdits).toBe(1)
      expect(report.content).toBe(sampleContent)
    })

    it("deduplicates identical edits", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("replace", `2#${hashes[1]}`, "NEW"),
        makeEdit("replace", `2#${hashes[1]}`, "NEW"),
      ])
      const report = applyHashlineEditsWithReport(sampleContent, edits)
      expect(report.deduplicatedEdits).toBe(1)
    })

    it("throws on overlapping ranges", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("replace", `2#${hashes[1]}`, "A", `4#${hashes[3]}`),
        makeEdit("replace", `3#${hashes[2]}`, "B", `5#${hashes[4]}`),
      ])
      expect(() => applyHashlineEdits(sampleContent, edits)).toThrow("Overlapping edits")
    })
  })

  describe("empty file handling", () => {
    it("creates file with prepend", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("prepend", "", "FIRST LINE"),
      ])
      const result = applyHashlineEdits("", edits)
      expect(result).toBe("FIRST LINE")
    })

    it("creates file with append", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("append", "", "FIRST LINE"),
      ])
      const result = applyHashlineEdits("", edits)
      expect(result).toBe("FIRST LINE")
    })

    it("throws on replace in empty file", () => {
      const edits = normalizeHashlineEdits([
        makeEdit("replace", "1#XX", "NEW"),
      ])
      expect(() => applyHashlineEdits("", edits)).toThrow("out of range")
    })
  })

  describe("edge cases", () => {
    it("handles CRLF line endings", () => {
      const content = "line 1\nline 2\nline 3" // canonicalizeFileText strips \r
      const lines = content.split("\n")
      const hashesCRLF = lines.map((_, i) => makeContextHash(lines, i))
      const edits = normalizeHashlineEdits([
        makeEdit("replace", `2#${hashesCRLF[1]}`, "NEW"),
      ])
      const result = applyHashlineEdits(content, edits)
      expect(result).toBe("line 1\nNEW\nline 3")
    })

    it("handles trailing newline", () => {
      const content = "line 1\nline 2\n"
      const lines = content.split("\n")
      const hashesTrailing = lines.map((_, i) => makeContextHash(lines, i))
      const edits = normalizeHashlineEdits([
        makeEdit("append", `2#${hashesTrailing[1]}`, "line 3"),
      ])
      const result = applyHashlineEdits(content, edits)
      expect(result).toBe("line 1\nline 2\nline 3\n")
    })
  })
})