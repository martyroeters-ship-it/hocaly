import { describe, expect, it } from "vitest"
import { containsWord, nounCase, normalizeTurkish, presentContinuous1sg, turkishLower } from "@/lib/turkish"

describe("Turkish normalization", () => {
  it("lowercases İ and I correctly", () => {
    expect(turkishLower("İSTANBUL")).toBe("istanbul")
    expect(turkishLower("IRMAK")).toBe("ırmak")
  })

  it("preserves original diacritics in the normalized key", () => {
    expect(normalizeTurkish("  Gül   ")).toBe("gül")
    expect(normalizeTurkish("Gül")).not.toBe(normalizeTurkish("Gul"))
  })

  it("detects inflected forms of a verb in a sentence", () => {
    expect(containsWord("Dün arkadaşımı anladım.", "anlamak")).toBe(true)
    expect(containsWord("Bugün tenis oynuyoruz.", "kitap")).toBe(false)
  })
})

describe("Turkish morphology helpers", () => {
  it("adds locative and dative endings, with an apostrophe on proper names", () => {
    expect(nounCase("İstanbul", "locative")).toBe("İstanbul'da")
    expect(nounCase("İstanbul", "dative")).toBe("İstanbul'a")
    expect(nounCase("ev", "locative")).toBe("evde")
    expect(nounCase("kitap", "accusative")).toBe("kitabı")
  })

  it("conjugates present continuous 1sg", () => {
    expect(presentContinuous1sg("gitmek")).toBe("gidiyorum")
    expect(presentContinuous1sg("okumak")).toBe("okuyorum")
    expect(presentContinuous1sg("anlamak")).toBe("anlıyorum")
  })
})
