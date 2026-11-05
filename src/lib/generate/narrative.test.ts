import { describe, expect, it } from "vitest"
import { composeTopicNarrative, sceneOf } from "@/lib/generate/narrative"

describe("composeTopicNarrative", () => {
  it("stays on a tennis match and omits letter-writing", () => {
    const result = composeTopicNarrative({
      topic: "Playing tennis",
      cefr: "A2",
      maxTargetWords: 3,
      words: [
        { turkish: "harf", english: "letter", partOfSpeech: "noun" },
        { turkish: "arkadaş", english: "friend", partOfSpeech: "noun" },
        { turkish: "hava", english: "weather", partOfSpeech: "noun" },
        { turkish: "top", english: "ball", partOfSpeech: "noun" },
      ],
    })
    expect(sceneOf("Playing tennis")).toBe("tennis")
    expect(sceneOf("Tenis Maçı")).toBe("tennis")
    expect(result.sentences.length).toBeGreaterThanOrEqual(5)
    const turkish = result.sentences.map((sentence) => sentence.turkish).join(" ")
    expect(turkish).toMatch(/tenis|kort/i)
    expect(turkish).not.toMatch(/harf|yazıyorum|mektup/i)
    expect(result.sentences.some((sentence) => /letter|writing/i.test(sentence.english))).toBe(false)
    expect(result.omittedWords).toContain("harf")
    expect(result.usedWords.length).toBeLessThanOrEqual(3)
  })
})
