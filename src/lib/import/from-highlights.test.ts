import { describe, expect, it } from "vitest"
import { highlightsToParsedRows } from "@/lib/import/from-highlights"

describe("highlightsToParsedRows", () => {
  it("keeps dictionary forms, tags photo words, and drops in-file duplicates", () => {
    const rows = highlightsToParsedRows([
      {
        turkish: "anlıyorum",
        dictionaryForm: "anlamak",
        english: "to understand",
        partOfSpeech: "verb",
        context: "Şimdi anlıyorum.",
        highlightColor: "yellow",
      },
      { turkish: "anlamak", english: "to understand" },
      { turkish: "  " },
      { turkish: "kitap", english: "book", partOfSpeech: "noun" },
    ])

    expect(rows.map((row) => row.turkish)).toEqual(["anlamak", "kitap"])
    expect(rows[0]).toMatchObject({
      english: "to understand",
      partOfSpeech: "verb",
      tags: ["photo", "want-to-learn"],
      highlightedForm: "anlıyorum",
      context: "Şimdi anlıyorum.",
    })
    expect(rows[1]?.tags).toContain("photo")
  })
})
