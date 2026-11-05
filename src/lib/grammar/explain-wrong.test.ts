import { describe, expect, it } from "vitest"
import { explainWrongAnswer } from "@/lib/grammar/explain-wrong"

describe("explainWrongAnswer", () => {
  it("flags missing words and diacritics", () => {
    const text = explainWrongAnswer("durmadan kostu", "Hiç durmadan koştu")
    expect(text.toLowerCase()).toMatch(/missing|hiç/)
    expect(text.toLowerCase()).toMatch(/spelling|letter/)
  })

  it("explains empty answers", () => {
    expect(explainWrongAnswer("", "Beklemeden gittik")).toMatch(/blank/i)
  })
})
