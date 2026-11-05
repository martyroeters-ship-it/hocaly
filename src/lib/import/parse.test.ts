import { describe, expect, it } from "vitest"
import { markFileDuplicates, parseImport } from "@/lib/import/parse"

describe("parseImport", () => {
  it("parses one word per line", () => {
    const rows = parseImport("gelmek\nanlamak\n\n# comment\narkadaş")
    expect(rows.map((row) => row.turkish)).toEqual(["gelmek", "anlamak", "arkadaş"])
    expect(rows[0]?.partOfSpeech).toBe("verb")
    expect(rows[2]?.partOfSpeech).toBeUndefined()
  })

  it("parses tab, comma, and semicolon pairs", () => {
    const rows = parseImport("gelmek\tto come\nanlamak; to understand\narkadaş, friend")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ turkish: "gelmek", english: "to come" })
    expect(rows[1]).toMatchObject({ turkish: "anlamak", english: "to understand" })
    expect(rows[2]).toMatchObject({ turkish: "arkadaş", english: "friend" })
  })

  it("parses CSV with headers", () => {
    const rows = parseImport("turkish,english,pos,cefr\ngelmek,to come,verb,A1")
    expect(rows[0]).toMatchObject({
      turkish: "gelmek",
      english: "to come",
      partOfSpeech: "verb",
      cefrLevel: "A1",
    })
  })

  it("parses JSON arrays and objects", () => {
    const rows = parseImport(
      JSON.stringify([
        "ev",
        { turkish: "su", english: "water", tags: ["daily"] },
      ]),
    )
    expect(rows[0]?.turkish).toBe("ev")
    expect(rows[1]).toMatchObject({ turkish: "su", english: "water", tags: ["daily"] })
  })

  it("marks in-file duplicates using Turkish-aware normalization", () => {
    const rows = markFileDuplicates(parseImport("Gelmek\ngelmek\nGÜL\ngül"))
    expect(rows[0]?.duplicateInFile).toBe(false)
    expect(rows[1]?.duplicateInFile).toBe(true)
    expect(rows[2]?.duplicateInFile).toBe(false)
    expect(rows[3]?.duplicateInFile).toBe(true)
  })

  it("does not treat gül and gul as the same word", () => {
    const rows = markFileDuplicates(parseImport("gül\ngul"))
    expect(rows.every((row) => !row.duplicateInFile)).toBe(true)
  })
})
