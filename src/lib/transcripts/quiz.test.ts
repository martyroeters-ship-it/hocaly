import { describe, expect, it } from "vitest"
import { looksLikeVerbForm } from "@/lib/transcripts/parse"
import { prioritizeWordsForGloss, selectTranscriptQuizItems } from "@/lib/transcripts/quiz"
import { normalizeTurkish } from "@/lib/turkish"

describe("selectTranscriptQuizItems", () => {
  const items = [
    { turkish: "geliyor", english: "is coming", targetId: "1" },
    { turkish: "Geliyor", english: "is coming", targetId: "1b" },
    { turkish: "kitap", english: "book", targetId: "2" },
    { turkish: "öğrenmek", english: "to learn", targetId: "3" },
    { turkish: "restoran", english: "restaurant", targetId: "4" },
    { turkish: "konuşuyoruz", english: "we are talking", targetId: "5" },
    { turkish: "sinema", english: "cinema", targetId: "6" },
    { turkish: "anladım", english: "I understood", targetId: "7" },
    { turkish: "bugün", english: "today", targetId: "8" },
    { turkish: "ev", english: "house", targetId: "9" },
    { turkish: "teşekkür", english: "thanks", targetId: "10" },
    { turkish: "müzisyen", english: "musician", targetId: "11" },
    { turkish: "hazırlanıyor", english: "is preparing", targetId: "12" },
    { turkish: "kütüphane", english: "library", targetId: "13" },
  ]

  it("dedupes by normalized Turkish", () => {
    const picked = selectTranscriptQuizItems(items, 12)
    const keys = picked.map((item) => normalizeTurkish(item.turkish))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.filter((key) => key === "geliyor").length).toBeLessThanOrEqual(1)
  })

  it("mixes verb-like forms with other vocab", () => {
    const picked = selectTranscriptQuizItems(items, 8)
    const verbs = picked.filter((item) => looksLikeVerbForm(item.turkish))
    const others = picked.filter((item) => !looksLikeVerbForm(item.turkish))
    expect(verbs.length).toBeGreaterThanOrEqual(2)
    expect(others.length).toBeGreaterThanOrEqual(2)
    expect(picked.length).toBe(8)
  })

  it("avoids previous keys when alternatives exist", () => {
    const first = selectTranscriptQuizItems(items, 6)
    const avoid = first.map((item) => item.turkish)
    const second = selectTranscriptQuizItems(items, 6, { avoidKeys: avoid })
    const overlap = second.filter((item) =>
      avoid.some((key) => normalizeTurkish(key) === normalizeTurkish(item.turkish)),
    )
    expect(overlap.length).toBeLessThan(second.length)
  })
})

describe("prioritizeWordsForGloss", () => {
  it("puts richer content ahead of easy/common words", () => {
    const ranked = prioritizeWordsForGloss(["bugün", "öğrenmek", "ve", "kütüphane", "geliyor"])
    expect(ranked[0]).not.toBe("bugün")
    expect(ranked.slice(0, 3).some((word) => /öğrenmek|kütüphane|geliyor/.test(word))).toBe(true)
  })
})
