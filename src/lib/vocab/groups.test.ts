import { describe, expect, it } from "vitest"
import { localGroups, mergeGroups, shufflePick, wordMatchesLexicon } from "@/lib/vocab/groups"
import { LEXICON_GROUPS } from "@/lib/vocab/lexicon"
import { pickByTopic } from "@/lib/vocab/topic"

const glue = LEXICON_GROUPS.find((item) => item.id === "glue")!

describe("connector detection", () => {
  it("groups çünkü, aslında, bu yüzden, ayrıca together", () => {
    const words = [
      { id: "1", turkish: "çünkü", english: "because", meanings: ["because"] },
      { id: "2", turkish: "aslında", english: "actually", meanings: ["in fact"] },
      { id: "3", turkish: "bu yüzden", english: "therefore", meanings: ["that's why"] },
      { id: "4", turkish: "ayrıca", english: "besides", meanings: ["moreover"] },
      { id: "5", turkish: "karpuz", english: "watermelon", meanings: ["watermelon"] },
    ]
    expect(wordMatchesLexicon(words[0]!, glue.turkish, glue.english)).toBe(true)
    const group = localGroups(words).find((item) => item.id === "glue")
    expect(group?.wordIds).toEqual(["1", "2", "3", "4"])
  })
})

describe("mergeGroups", () => {
  it("does not keep a fake sentence-glue group", () => {
    const local = localGroups([
      { id: "h", turkish: "merhaba", english: "hello", meanings: ["hello"] },
      { id: "t", turkish: "teşekkürler", english: "thanks", meanings: ["thanks"] },
    ])
    const merged = mergeGroups(local, [
      { id: "ai:glue", name: "Sentence glue", help: "", wordIds: ["h", "t"], source: "ai" },
    ])
    expect(merged.some((group) => /glue/i.test(group.name))).toBe(false)
  })
})

describe("shufflePick", () => {
  it("returns the requested count without duplicates", () => {
    const picked = shufflePick(["a", "b", "c", "d"], 3)
    expect(picked).toHaveLength(3)
    expect(new Set(picked).size).toBe(3)
  })
})

describe("pickByTopic", () => {
  it("prefers holiday-related words from the library", () => {
    const words = [
      { id: "sea", turkish: "deniz", english: "sea", meanings: ["sea"] },
      { id: "sun", turkish: "güneş", english: "sun", meanings: ["sun"] },
      { id: "bulb", turkish: "ampul", english: "light bulb", meanings: ["light bulb"] },
    ]
    expect(pickByTopic(words, "holiday", 5)).toEqual(["sea", "sun"])
  })
})
