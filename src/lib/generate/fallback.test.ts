import { describe, expect, it } from "vitest"
import { deriveStoryTopic, fallbackCombinedSentence, fallbackStory } from "@/lib/generate/fallback"
import { storyPrompt } from "@/lib/ai/prompts"
import { isStoryDump } from "@/lib/speech/script"
import { containsWord } from "@/lib/turkish"

const LAMP_WORDS = [
  { turkish: "ampul", english: "light bulb", partOfSpeech: "noun" },
  { turkish: "beğenmek", english: "to like", partOfSpeech: "verb" },
  { turkish: "cömert", english: "generous", partOfSpeech: "adjective" },
  { turkish: "ev", english: "house", partOfSpeech: "noun" },
  { turkish: "istek", english: "wish; request", partOfSpeech: "noun" },
  { turkish: "hava", english: "weather; air", partOfSpeech: "noun" },
]

describe("fallback generation", () => {
  it("builds a natural scene for güzel, İstanbul, and kitap", () => {
    const result = fallbackCombinedSentence([
      { turkish: "güzel", english: "beautiful; nice", partOfSpeech: "adjective" },
      { turkish: "İstanbul", english: "Istanbul", partOfSpeech: "noun" },
      { turkish: "kitap", english: "book", partOfSpeech: "noun" },
    ])
    expect(result.turkish).toContain("İstanbul'da")
    expect(result.turkish).toContain("güzel")
    expect(result.turkish).toContain("kitap")
    expect(result.turkish).toMatch(/okuyorum/i)
    expect(result.turkish).not.toMatch(/kullanıyorum/)
    expect(result.english.toLowerCase()).toContain("reading")
    expect(result.english.toLowerCase()).not.toContain("using")
  })

  it("uses selected words in one inflected sentence", () => {
    const result = fallbackCombinedSentence([
      { turkish: "anlamak", english: "to understand", partOfSpeech: "verb" },
      { turkish: "arkadaş", english: "friend", partOfSpeech: "noun" },
      { turkish: "bugün", english: "today", partOfSpeech: "adverb" },
    ])
    expect(result.turkish).toMatch(/anlıyorum/)
    expect(result.turkish).toContain("arkadaş")
    expect(result.turkish).toContain("bugün")
    expect(result.turkish).not.toMatch(/kullanıyorum/)
    expect(result.english.length).toBeGreaterThan(0)
  })

  it("builds a short story from the same word list", () => {
    const result = fallbackStory([{ turkish: "ev", english: "house", partOfSpeech: "noun" }], "home")
    expect(containsWord(result.turkish, "ev")).toBe(true)
    expect(result.sentences.length).toBeGreaterThan(0)
    expect(result.turkish).not.toMatch(/bu konuda önemli/)
  })

  it("builds a connected home scene from fitting words instead of an Istanbul walk", () => {
    const result = fallbackStory(LAMP_WORDS, "", "A1", { seed: 4 })
    expect(result.sentences.length).toBeGreaterThanOrEqual(5)
    expect(containsWord(result.turkish, "ev")).toBe(true)
    expect(result.usedWords.length).toBeLessThanOrEqual(3)
    expect(result.omittedWords).toEqual(expect.arrayContaining(["cömert"]))
    expect(result.turkish).not.toMatch(/simit|çay|İstanbul/i)
    expect(result.english).not.toMatch(/simit|Istanbul morning|I am writing a letter/i)
    expect(result.title).not.toMatch(/istanbul|tennis|everyday life/i)
    expect(result.turkish).not.toMatch(/Bir istek var|Bunu beğenmek istiyorum/)
    expect(isStoryDump(result.sentences, result.title)).toBe(false)
  })

  it("varies the local story when the seed changes", () => {
    const a = fallbackStory(LAMP_WORDS, "", "A1", { seed: 1 })
    const b = fallbackStory(LAMP_WORDS, "", "A1", { seed: 2, avoidTitle: a.title })
    expect(a.turkish).not.toEqual(b.turkish)
    expect(a.title).not.toEqual(b.title)
  })

  it("omits mismatched adjectives when the topic names Istanbul", () => {
    const result = fallbackStory(
      [
        { turkish: "cömert", english: "generous", partOfSpeech: "adjective" },
        { turkish: "süslemek", english: "to decorate, to adorn", partOfSpeech: "verb" },
        { turkish: "yarışma", english: "competition; contest", partOfSpeech: "noun" },
        { turkish: "okul", english: "school", partOfSpeech: "noun" },
      ],
      "A morning in Istanbul",
      "A2",
      { seed: 8 },
    )
    expect(result.sentences.length).toBeGreaterThanOrEqual(5)
    expect(result.turkish).toMatch(/İstanbul/i)
    expect(containsWord(result.turkish, "okul")).toBe(true)
    expect(result.turkish).not.toMatch(/cömert|süsle|yarışma|önemli/i)
    expect(result.english).not.toMatch(/comes to mind|is part of my story|generous|contest/i)
    expect(result.omittedWords).toEqual(expect.arrayContaining(["cömert", "süslemek", "yarışma"]))
    expect(isStoryDump(result.sentences, result.title)).toBe(false)
  })

  it("writes a connected tennis scene and omits letter-writing", () => {
    const result = fallbackStory(
      [
        { turkish: "harf", english: "letter", partOfSpeech: "noun" },
        { turkish: "arkadaş", english: "friend", partOfSpeech: "noun" },
        { turkish: "hava", english: "weather", partOfSpeech: "noun" },
        { turkish: "güzel", english: "nice", partOfSpeech: "adjective" },
        { turkish: "top", english: "ball", partOfSpeech: "noun" },
        { turkish: "inatçı", english: "stubborn", partOfSpeech: "adjective" },
      ],
      "Playing tennis",
      "A2",
      { seed: 3 },
    )
    expect(result.title).toMatch(/tennis/i)
    expect(result.sentences.length).toBeGreaterThanOrEqual(5)
    expect(result.turkish).toMatch(/tenis|kort/i)
    expect(result.turkish).not.toMatch(/harf|yazıyorum|mektup/i)
    expect(result.english).not.toMatch(/letter|writing/i)
    expect(result.omittedWords).toContain("harf")
    expect(result.usedWords.length).toBeLessThanOrEqual(3)
    expect(isStoryDump(result.sentences, result.title)).toBe(false)
  })

  it("derives a title from the selected words", () => {
    expect(deriveStoryTopic(LAMP_WORDS, "A1")).toMatch(/bulb|house|lamp/i)
    expect(deriveStoryTopic(LAMP_WORDS, "A1")).not.toMatch(/istanbul|tennis/i)
  })
})

describe("storyPrompt", () => {
  it("asks for a topic scene with seasoning words, not a vocab spine", () => {
    const prompt = storyPrompt({
      words: LAMP_WORDS.map((word) => ({ turkish: word.turkish, english: word.english })),
      topic: "Playing tennis",
      cefr: "A1",
      length: 160,
      knownGrammar: [],
      introduceNew: false,
      seed: 7,
      avoidTitle: "Everyday life in Istanbul",
    })
    expect(prompt.system).toMatch(/TOPIC is the scene/i)
    expect(prompt.system).toMatch(/optional seasoning/i)
    expect(prompt.system).toMatch(/setting → action → reaction → continue/)
    expect(prompt.system).toMatch(/Ben bir harf yazıyorum/)
    expect(prompt.system).not.toMatch(/SPINE is the target vocabulary/)
    expect(prompt.system).toMatch(/Do not default to an Istanbul morning/)
    expect(prompt.user).toContain("avoidTitle")
    expect(prompt.user).toContain("Playing tennis")
    expect(prompt.user).toMatch(/seasoning/)
  })
})
