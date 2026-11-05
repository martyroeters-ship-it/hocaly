import { describe, expect, it } from "vitest"
import { selectedTextForTranslate, textForTranslate, wordFromTextOffset } from "@/lib/translate/selection"

describe("selectedTextForTranslate", () => {
  it("keeps a short Turkish phrase", () => {
    expect(selectedTextForTranslate(null, "  bu yoldan  ")).toBe("bu yoldan")
  })

  it("ignores empty or punctuation-only selections", () => {
    expect(selectedTextForTranslate(null, "   ")).toBeNull()
    expect(selectedTextForTranslate(null, "...")).toBeNull()
  })

  it("ignores selections inside inputs", () => {
    const input = { closest: (selector: string) => (selector.includes("input") ? input : null) }
    expect(selectedTextForTranslate(input as unknown as EventTarget, "yol")).toBeNull()
  })
})

describe("wordFromTextOffset", () => {
  it("picks the word under the caret", () => {
    expect(wordFromTextOffset("Bugün İstanbul'da kahve içtim.", 8)).toBe("İstanbul'da")
  })

  it("steps back when the caret is at the end of a word", () => {
    const text = "gidiyorum."
    expect(wordFromTextOffset(text, text.indexOf("."))).toBe("gidiyorum")
  })

  it("returns null in whitespace", () => {
    expect(wordFromTextOffset("iki  kelime", 4)).toBeNull()
  })
})

describe("textForTranslate", () => {
  it("prefers an existing selection", () => {
    expect(textForTranslate(null, "bu yoldan")).toBe("bu yoldan")
  })

  it("falls back to a single token on the event target", () => {
    const span = { textContent: "gidiyorum", closest: () => null }
    expect(textForTranslate(span as unknown as EventTarget, "")).toBe("gidiyorum")
  })

  it("does not guess a whole sentence from the target", () => {
    const line = { textContent: "Bugün kahve içtim.", closest: () => null }
    expect(textForTranslate(line as unknown as EventTarget, "")).toBeNull()
  })
})
