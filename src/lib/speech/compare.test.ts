import { describe, expect, it } from "vitest"
import { compareSpoken, ratingFromSkillResult } from "@/lib/speech/compare"

describe("compareSpoken", () => {
  it("marks a near-complete repeat as correct and lists no missing content words", () => {
    const result = compareSpoken("Bugün parka gidiyorum.", "Bugün parka gidiyorum")
    expect(result.result).toBe("correct")
    expect(result.missing).toEqual([])
    expect(result.disclaimer).toMatch(/does not measure pronunciation/i)
  })

  it("reports missing vocabulary when a content word is dropped", () => {
    const result = compareSpoken("Kitabı masanın üstüne koydum.", "Kitabı üstüne koydum")
    expect(result.missing).toContain("masanın")
    expect(["partial", "spelling", "incorrect"]).toContain(result.result)
  })

  it("treats missing Turkish diacritics as matched words", () => {
    const result = compareSpoken("Teşekkürler arkadaşlar", "Tesekkurler arkadaslar")
    expect(result.result).toBe("correct")
    expect(result.missing).toEqual([])
  })

  it("does not treat an unrelated sentence as a pass", () => {
    const result = compareSpoken("Kahve içmek istiyorum", "Yarın sinemaya gideceğiz")
    expect(result.result).toBe("incorrect")
    expect(result.coverage).toBeLessThan(0.45)
  })
})

describe("ratingFromSkillResult", () => {
  it("keeps listening and speaking failures from counting as mastery", () => {
    expect(ratingFromSkillResult("correct")).toBe("good")
    expect(ratingFromSkillResult("partial")).toBe("hard")
    expect(ratingFromSkillResult("incorrect")).toBe("again")
  })
})
