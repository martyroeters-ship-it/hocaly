import { describe, expect, it } from "vitest"
import { tokenize, tokensWithSpacing } from "@/lib/reading"

describe("tokenize", () => {
  it("keeps spaces and punctuation as their own tokens", () => {
    expect(tokenize("Bu sabah İstanbul'da yürüyorum.")).toEqual([
      "Bu",
      " ",
      "sabah",
      " ",
      "İstanbul'da",
      " ",
      "yürüyorum",
      ".",
    ])
  })
})

describe("tokensWithSpacing", () => {
  it("does not double spaces when the tokenizer already kept them", () => {
    expect(tokensWithSpacing(tokenize("Hava güzel, sokak henüz sakin.")).join("")).toBe(
      "Hava güzel, sokak henüz sakin.",
    )
  })

  it("inserts a space between packed word tokens", () => {
    expect(tokensWithSpacing(["Bu", "sabah", "İstanbul'da"]).join("")).toBe("Bu sabah İstanbul'da")
  })

  it("inserts a space after punctuation before the next word", () => {
    expect(tokensWithSpacing(["yürüyorum", ".", "Hava", ",", "sokak"]).join("")).toBe(
      "yürüyorum. Hava, sokak",
    )
  })
})
