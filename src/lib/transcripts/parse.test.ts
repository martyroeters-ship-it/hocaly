import { describe, expect, it } from "vitest"
import { contentWordScore, looksLikeVerbForm, parseTranscriptText } from "@/lib/transcripts/parse"

describe("looksLikeVerbForm", () => {
  it("detects infinitives and common finite forms", () => {
    expect(looksLikeVerbForm("öğrenmek")).toBe(true)
    expect(looksLikeVerbForm("gidiyorum")).toBe(true)
    expect(looksLikeVerbForm("anladım")).toBe(true)
    expect(looksLikeVerbForm("konuşacağız")).toBe(true)
    expect(looksLikeVerbForm("kitap")).toBe(false)
  })
})

describe("parseTranscriptText target selection", () => {
  it("does not only take the first three tokens", () => {
    const text =
      "Bugün arkadaşımla birlikte güzel bir restoranda akşam yemeği yedik ve sonra sinemaya gittik."
    const [sentence] = parseTranscriptText(text)
    expect(sentence).toBeTruthy()
    const targets = sentence!.targets.map((item) => item.turkish.toLocaleLowerCase("tr-TR"))
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.length).toBeLessThanOrEqual(3)
    // Should prefer content / verbs over early easy words like bugün
    expect(targets.some((word) => /restoran|yemek|sinema|gitt|yed|arkadaş/.test(word))).toBe(true)
  })

  it("scores content words above stop/easy forms", () => {
    expect(contentWordScore("ve")).toBeLessThan(0)
    expect(contentWordScore("öğrenmek")).toBeGreaterThan(contentWordScore("bugün"))
    expect(contentWordScore("restoran")).toBeGreaterThan(contentWordScore("ev"))
  })
})
