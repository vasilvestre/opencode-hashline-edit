import { describe, expect, it } from "vitest"
import { tagReadContent } from "./read-anchors.js"
import { computeContextHash } from "./validation.js"

const FILE = ["const x = 1", "function foo() {", "  return x", "}"].join("\n")

describe("tagReadContent", () => {
  it("replaces the read line prefix with a LINE#ID anchor", () => {
    const read = "1: const x = 1\n2: function foo() {"
    const out = tagReadContent(read, FILE)
    const lines = out.split("\n")
    expect(lines[0]).toBe(`1#${computeContextHash(FILE.split("\n"), 0)}|const x = 1`)
    expect(lines[1]).toBe(`2#${computeContextHash(FILE.split("\n"), 1)}|function foo() {`)
  })

  it("hashes against the whole file for a window that starts mid-file", () => {
    const out = tagReadContent("3:   return x", FILE)
    const expected = computeContextHash(FILE.split("\n"), 2)
    expect(out).toBe(`3#${expected}|  return x`)
  })

  it("leaves an already tagged line alone", () => {
    const read = "1#AB|const x = 1"
    expect(tagReadContent(read, FILE)).toBe(read)
  })

  it("leaves content it does not recognise untouched", () => {
    const read = "no numbers here"
    expect(tagReadContent(read, FILE)).toBe(read)
  })

  it("ignores a line number outside the file", () => {
    const read = "99: ghost"
    expect(tagReadContent(read, FILE)).toBe(read)
  })
})
