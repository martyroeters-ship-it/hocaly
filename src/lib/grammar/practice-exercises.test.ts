import { describe, expect, it } from "vitest"
import {
  buildPracticeExercises,
  practiceFormLabel,
} from "@/lib/grammar/practice-exercises"
import { mutateWrongForm } from "@/lib/grammar/conjugate"

describe("practice exercises", () => {
  it("labels without-doing cleanly", () => {
    expect(practiceFormLabel("without-doing")).toBe("without doing")
  })

  it("builds conjugation items with isolated verb prompts", () => {
    const items = buildPracticeExercises("without-doing", "conjugation", 5)
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.every((item) => item.kind === "conjugation")).toBe(true)
    expect(items[0]?.instruction).toMatch(/without doing/i)
    expect(items[0]?.turkishPrompt).toMatch(/^Verb:/)
  })

  it("builds full-sentence Turkish blanks (not isolated person cues)", () => {
    const items = buildPracticeExercises("without-doing", "blank", 10)
    expect(items.length).toBe(10)
    for (const item of items) {
      expect(item.kind).toBe("blank")
      expect(item.turkishPrompt).toContain("______")
      expect(item.englishPrompt?.split(/\s+/).length).toBeGreaterThan(3)
      expect(item.turkishPrompt).not.toMatch(/^(Ben|Sen|O|Biz|Siz|Onlar) ______/)
      expect(item.englishPrompt?.toLowerCase()).not.toMatch(/^without \w+$/)
    }
  })

  it("builds full-sentence translations with variants", () => {
    const items = buildPracticeExercises("without-doing", "translate", 3)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]?.kind).toBe("translate")
    expect(items[0]?.accepted.length).toBeGreaterThan(1)
  })

  it("builds transformation combine prompts", () => {
    const items = buildPracticeExercises("without-doing", "transform", 3)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]?.kind).toBe("transform")
    expect(items[0]?.sourceSentences?.length).toBe(2)
    expect(items[0]?.expected.toLocaleLowerCase("tr-TR")).toMatch(/madan|meden/)
  })

  it("master mix has 10 items across kinds", () => {
    const items = buildPracticeExercises("without-doing", "master")
    expect(items).toHaveLength(10)
    const kinds = new Set(items.map((item) => item.kind))
    expect(kinds.size).toBe(5)
  })

  it("mutates -madan with a harmony slip", () => {
    expect(mutateWrongForm("yapmadan")).toBe("yapmaden")
  })
})
