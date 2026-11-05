import { describe, expect, it } from "vitest"
import { evaluateAgainst, evaluateTurkishTranslation } from "@/lib/eval/match"

describe("evaluateAgainst", () => {
  it("accepts exact English meanings and optional to-prefix", () => {
    expect(evaluateAgainst("to come", ["come", "arrive"], "en").result).toBe("correct")
    expect(evaluateAgainst("come", ["to come"], "en").result).toBe("correct")
  })

  it("accepts alternative meanings separated in the answer key", () => {
    expect(evaluateAgainst("nice", ["beautiful; nice", "pretty"], "en").result).toBe("correct")
    expect(evaluateAgainst("handful", ["palm, handful"], "en").result).toBe("correct")
  })

  it("treats missing Turkish diacritics as a spelling result", () => {
    expect(evaluateAgainst("tesekkurler", ["teşekkürler"], "tr").result).toBe("spelling")
    expect(evaluateAgainst("arkadas", ["arkadaş"], "tr").result).toBe("spelling")
  })

  it("treats a nearby typo as spelling", () => {
    expect(evaluateAgainst("freind", ["friend"], "en").result).toBe("spelling")
  })

  it("returns partial for overlapping multi-word answers", () => {
    expect(evaluateAgainst("come here", ["to come"], "en").result).toBe("partial")
  })

  it("returns incorrect when the meaning is unrelated", () => {
    expect(evaluateAgainst("cat", ["to come"], "en").result).toBe("incorrect")
  })

  it("rejects ğ→k soft-g collapses, but accepts ğ→g as spelling", () => {
    expect(evaluateAgainst("gelmeyecekiz", ["gelmeyeceğiz"], "tr").result).toBe("incorrect")
    expect(evaluateAgainst("gelecekiz", ["geleceğiz"], "tr").result).toBe("incorrect")
    expect(evaluateAgainst("gelecegiz", ["geleceğiz"], "tr").result).toBe("spelling")
    expect(evaluateAgainst("gelecegim", ["geleceğim"], "tr").result).toBe("spelling")
    expect(evaluateAgainst("gelmeyeceğiz", ["gelmeyeceğiz"], "tr").result).toBe("correct")
    expect(evaluateAgainst("geleceğiz", ["geleceğiz"], "tr").result).toBe("correct")
    expect(evaluateAgainst("geleceğim", ["geleceğim"], "tr").result).toBe("correct")
    // Other missing diacritics still count as spelling
    expect(evaluateAgainst("tesekkurler", ["teşekkürler"], "tr").result).toBe("spelling")
    expect(evaluateAgainst("arkadas", ["arkadaş"], "tr").result).toBe("spelling")
  })

  it("rejects missing buffer y and other near-miss Turkish forms (no levenshtein)", () => {
    expect(evaluateAgainst("yazmacaklar", ["yazmayacaklar"], "tr").result).toBe("incorrect")
    expect(evaluateAgainst("yazmacak", ["yazmayacak"], "tr").result).toBe("incorrect")
    expect(evaluateAgainst("gelmecegim", ["gelmeyeceğim"], "tr").result).toBe("incorrect")
    expect(evaluateAgainst("gelecekiz", ["geleceğiz"], "tr").result).toBe("incorrect")
    expect(evaluateAgainst("gelecegim", ["geleceğim"], "tr").result).toBe("spelling")
    expect(evaluateAgainst("yazmayacaklar", ["yazmayacaklar"], "tr").result).toBe("correct")
  })
})

describe("evaluateTurkishTranslation", () => {
  it("accepts synonym main verbs when the grammar form is correct", () => {
    expect(
      evaluateTurkishTranslation("beklemeden ciktik", ["Beklemeden gittik"], "beklemeden").result,
    ).toBe("correct")
    expect(
      evaluateTurkishTranslation("Beklemeden çıktık", ["Beklemeden gittik"], "Beklemeden").result,
    ).toBe("correct")
  })

  it("rejects answers missing the required grammar form", () => {
    expect(
      evaluateTurkishTranslation("bekleyerek gittik", ["Beklemeden gittik"], "beklemeden").result,
    ).toBe("incorrect")
  })
})
