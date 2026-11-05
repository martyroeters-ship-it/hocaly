import { describe, expect, it } from "vitest"
import { fallbackListeningScript, isDummyStoryDump, isListLikeListening, isStoryDump } from "@/lib/speech/script"

const DUMP_WORDS = [
  { id: "1", turkish: "cömert", english: "generous", partOfSpeech: "adjective" },
  { id: "2", turkish: "süslemek", english: "to decorate, to adorn", partOfSpeech: "verb" },
  { id: "3", turkish: "yarışma", english: "competition; contest", partOfSpeech: "noun" },
  { id: "4", turkish: "incelemek", english: "to examine", partOfSpeech: "verb" },
  { id: "5", turkish: "alışkanlık", english: "habit", partOfSpeech: "noun" },
]

describe("fallbackListeningScript", () => {
  it("builds a spoken scene from selected vocabulary", () => {
    const script = fallbackListeningScript({
      topic: "Park",
      format: "conversation",
      durationSec: 30,
      cefr: "A2",
      words: [
        { id: "1", turkish: "park", english: "park", partOfSpeech: "noun" },
        { id: "2", turkish: "kitap", english: "book", partOfSpeech: "noun" },
      ],
    })
    expect(script.sentences.length).toBeGreaterThanOrEqual(4)
    expect(script.turkish).toMatch(/park/i)
    expect(script.turkish).toMatch(/kitap/i)
    expect(script.turkish).not.toMatch(/önemli/)
    expect(script.english).not.toMatch(/comes to mind|is part of my story/i)
    expect(script.questions[0]?.choices.length).toBeGreaterThanOrEqual(2)
    expect(script.sentences.some((sentence) => sentence.speaker === "Ada")).toBe(true)
  })

  it("writes a connected Istanbul morning instead of listing words", () => {
    const script = fallbackListeningScript({
      topic: "A morning in Istanbul",
      format: "monologue",
      durationSec: 60,
      cefr: "A2",
      words: [
        { id: "1", turkish: "akıllı", english: "smart", partOfSpeech: "adjective" },
        { id: "2", turkish: "aptal", english: "stupid", partOfSpeech: "adjective" },
        { id: "3", turkish: "acele etmek", english: "to hurry", partOfSpeech: "verb" },
      ],
    })
    expect(isListLikeListening(script.sentences)).toBe(false)
    expect(script.sentences.every((sentence) => !/önemli/.test(sentence.turkish))).toBe(true)
    expect(script.sentences.length).toBeGreaterThanOrEqual(5)
    expect(script.turkish).toMatch(/İstanbul/i)
    expect(script.turkish).toMatch(/simit|çay/i)
    expect(script.english).toMatch(/walking|walk/i)
    expect(script.english).not.toMatch(/comes to mind|is part of my story|to adorn/i)
    expect(script.omittedWords).toEqual(expect.arrayContaining(["akıllı", "aptal"]))
    expect(script.usedWords).not.toEqual(expect.arrayContaining(["akıllı", "aptal"]))
  })

  it("omits mismatched vocab instead of stuffing generous/decorate/contest", () => {
    const script = fallbackListeningScript({
      topic: "A morning in Istanbul",
      format: "monologue",
      durationSec: 60,
      cefr: "A2",
      words: DUMP_WORDS,
    })
    expect(isListLikeListening(script.sentences)).toBe(false)
    expect(script.turkish).toMatch(/İstanbul/i)
    expect(script.turkish).toMatch(/simit|çay|cami|vapur/i)
    expect(script.turkish).not.toMatch(/cömert|süsle|yarışma|incele|alışkanlık/i)
    expect(script.english).not.toMatch(/generous|decorate|adorn|contest|comes to mind|examine|habit is part/i)
    expect(script.omittedWords).toEqual(expect.arrayContaining(DUMP_WORDS.map((word) => word.turkish)))
    expect(script.sentences.length).toBeGreaterThanOrEqual(5)
    expect(script.sentences.length).toBeLessThanOrEqual(8)
  })

  it("can mention a school as scenery on the same walk", () => {
    const script = fallbackListeningScript({
      topic: "A morning in Istanbul",
      format: "monologue",
      durationSec: 60,
      cefr: "A2",
      words: [
        { id: "1", turkish: "okul", english: "school", partOfSpeech: "noun" },
        ...DUMP_WORDS,
      ],
    })
    expect(script.turkish).toMatch(/okul/i)
    expect(script.turkish).toMatch(/geçiyorum|devam/i)
    expect(script.usedWords).toContain("okul")
    expect(script.omittedWords).toEqual(expect.arrayContaining(["cömert", "yarışma", "alışkanlık"]))
  })
})

describe("isListLikeListening", () => {
  it("rejects dummy önemli lines", () => {
    expect(
      isListLikeListening([
        { turkish: "Öğretmen çok hızlı konuştu.", english: "The teacher spoke very quickly." },
        { turkish: "akıllı önemli.", english: "smart matters." },
        { turkish: "aptal önemli.", english: "stupid matters." },
      ]),
    ).toBe(true)
  })

  it("rejects the old one-word-per-sentence dump", () => {
    expect(
      isListLikeListening([
        { turkish: "Bu sabah İstanbul'da yürüyorum.", english: "This morning I am walking in Istanbul." },
        { turkish: "Bugün kendimi biraz cömert hissediyorum.", english: "Today I feel a bit generous." },
        { turkish: "Karşıda bir okul var.", english: "There is a school across from me." },
        { turkish: "Biraz durup süslüyorum.", english: "I pause and decorate, to adorn." },
        { turkish: "Yarışma da aklıma geliyor.", english: "Competition, contest also comes to mind." },
        { turkish: "Sonra inceliyorum ve yola devam ediyorum.", english: "Then I examine and continue on my way." },
        { turkish: "Alışkanlık bu sabah hikayemin bir parçası.", english: "Habit is part of my story this morning." },
      ]),
    ).toBe(true)
  })

  it("does not treat a natural house-and-lamp scene as a dummy dump", () => {
    expect(
      isDummyStoryDump([
        { turkish: "Evdeyim.", english: "I am at home." },
        { turkish: "Komşum cömert.", english: "My neighbor is generous." },
        { turkish: "Masada bir ampul var.", english: "There is a light bulb on the table." },
        { turkish: "Ampulü beğeniyorum.", english: "I like the light bulb." },
        { turkish: "Karşıda bir ev var.", english: "There is a house across from me." },
      ]),
    ).toBe(false)
  })

  it("rejects a tennis vocab dump that jumps to letter-writing", () => {
    const dump = [
      { turkish: "Hava çok güzel.", english: "The weather is very nice." },
      { turkish: "Arkadaşım inatçı bir oyuncu.", english: "My friend is a stubborn player." },
      { turkish: "Ben bir harf yazıyorum.", english: "I am writing a letter." },
      { turkish: "Oyun başlıyor.", english: "The game is starting." },
      { turkish: "Top geliyor.", english: "The ball is coming." },
      { turkish: "Ben koşuyorum.", english: "I am running." },
    ]
    expect(isStoryDump(dump, "Tenis Maçı")).toBe(true)
    expect(isStoryDump(dump, "Playing tennis")).toBe(true)
  })

  it("accepts a connected tennis match", () => {
    expect(
      isStoryDump(
        [
          { turkish: "Arkadaşımla tenis kortundayız.", english: "My friend and I are on the tennis court." },
          { turkish: "Hava güzel, kort güneşli.", english: "The weather is nice, and the court is sunny." },
          { turkish: "Oyun başlıyor ve arkadaşım servis atıyor.", english: "The game starts and my friend serves." },
          { turkish: "Top bana geliyor.", english: "The ball is coming toward me." },
          { turkish: "Koşup raketi uzatıyorum.", english: "I run and stretch out the racket." },
          { turkish: "Topu geri gönderiyorum ve oyun devam ediyor.", english: "I send the ball back and the game continues." },
        ],
        "Playing tennis",
      ),
    ).toBe(false)
  })

  it("accepts a real scene", () => {
    expect(
      isListLikeListening([
        { turkish: "Sabah İstanbul'da yürüyorum.", english: "I am walking in Istanbul in the morning." },
        { turkish: "Fırından simit alıp çay içiyorum.", english: "I buy a simit from the bakery and drink tea." },
        { turkish: "Karşıda bir cami var, yanından geçiyorum.", english: "There is a mosque across from me; I walk past it." },
      ]),
    ).toBe(false)
  })
})
