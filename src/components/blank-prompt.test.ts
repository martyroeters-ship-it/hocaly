import { describe, expect, it } from "vitest"
import { stripBlankLemma } from "@/components/blank-prompt"

describe("stripBlankLemma", () => {
  it("strips lemma glued after the blank", () => {
    expect(stripBlankLemma("Biz ______ (yapmak)")).toBe("Biz ______")
  })

  it("strips lemma when ? is between blank and paren (legacy cue)", () => {
    expect(stripBlankLemma("Biz ______? (yapmak)")).toBe("Biz ______?")
  })

  it("strips lemma when ? follows the paren", () => {
    expect(stripBlankLemma("Biz ______ (yapmak)?")).toBe("Biz ______?")
  })

  it("leaves text without a blank lemma alone", () => {
    expect(stripBlankLemma("Biz ______")).toBe("Biz ______")
    expect(stripBlankLemma("Just (yapmak)")).toBe("Just (yapmak)")
  })
})
