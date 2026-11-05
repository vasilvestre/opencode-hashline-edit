import { describe, expect, it } from "vitest"
import { applyHashlineEdits } from "./edit-operations.js"
import { computeContextHash } from "./validation.js"

const TAG = /[0-9]+#[A-Z]{2,4}/

describe("written content", () => {
  it("never carries an anchor tag", () => {
    const file = "a\nb\nc"
    const pos = `2#${computeContextHash(file.split("\n"), 1)}`
    const out = applyHashlineEdits(file, [{ op: "replace", pos, lines: "B" }])
    expect(out).toBe("a\nB\nc")
    expect(out).not.toMatch(TAG)
  })
})
