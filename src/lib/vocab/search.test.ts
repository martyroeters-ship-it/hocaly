import { describe, expect, it } from "vitest"
import { filterWords, wordMatchesQuery } from "@/lib/vocab/search"

const hurry = {
  turkish: "acele etmek",
  english: "to hurry",
  dictionaryForm: "acele etmek",
  meanings: ["to hurry", "to rush"],
}

const light = {
  turkish: "ışık",
  english: "light",
  dictionaryForm: "ışık",
  meanings: ["light"],
}

const school = {
  turkish: "okul",
  english: "school",
  dictionaryForm: "okul",
  meanings: ["school"],
}

describe("wordMatchesQuery", () => {
  it("matches English glosses", () => {
    expect(wordMatchesQuery(hurry, "hurry")).toBe(true)
    expect(wordMatchesQuery(hurry, "RUSH")).toBe(true)
    expect(wordMatchesQuery(hurry, "okul")).toBe(false)
  })

  it("matches Turkish headwords and dictionary form", () => {
    expect(wordMatchesQuery(hurry, "acele")).toBe(true)
    expect(wordMatchesQuery(school, "okul")).toBe(true)
    expect(wordMatchesQuery({ ...hurry, turkish: "acele etti", dictionaryForm: "acele etmek" }, "acele etmek")).toBe(
      true,
    )
  })

  it("is case-insensitive and folds Turkish ı/i, ş, ğ", () => {
    expect(wordMatchesQuery(school, "OKUL")).toBe(true)
    expect(wordMatchesQuery(light, "isik")).toBe(true)
    expect(wordMatchesQuery(light, "IŞIK")).toBe(true)
    expect(wordMatchesQuery({ turkish: "şimşek", english: "lightning", meanings: ["lightning"] }, "simsek")).toBe(true)
    expect(wordMatchesQuery({ turkish: "yağmur", english: "rain", meanings: ["rain"] }, "yagmur")).toBe(true)
  })

  it("keeps the full list when the query is empty", () => {
    const words = [hurry, school, light]
    expect(filterWords(words, "")).toEqual(words)
    expect(filterWords(words, "   ")).toEqual(words)
    expect(filterWords(words, "hurry")).toEqual([hurry])
  })
})
